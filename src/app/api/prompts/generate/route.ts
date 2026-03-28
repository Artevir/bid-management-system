/**
 * 方案生成API
 * 根据模板和参数生成方案内容
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { 
  promptTemplates, 
  promptParameters, 
  schemeGenerations,
  projects,
} from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getLLM, getLLMByProvider } from '@/lib/llm';
import { LLMProvider } from '@/lib/llm/types';

// ============================================
// POST: 生成方案内容
// ============================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const {
      templateId,
      projectId,
      parameters: inputParams,
      stream = true,
    } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: '缺少模板ID' },
        { status: 400 }
      );
    }

    // 获取模板
    const [template] = await db
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.id, templateId));

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    // 获取模板参数定义
    const paramDefs = await db
      .select()
      .from(promptParameters)
      .where(eq(promptParameters.templateId, templateId))
      .orderBy(asc(promptParameters.sortOrder));

    // 获取项目信息（如果有）
    let projectInfo: any = null;
    if (projectId) {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));
      projectInfo = project;
    }

    // 构建参数值（合并默认值和输入值）
    const paramValues: Record<string, string> = {};
    
    // 先填充默认值
    for (const param of paramDefs) {
      // 尝试自动绑定
      if (param.bindingType === 'project_field' && projectInfo && param.bindingField) {
        const value = getNestedValue(projectInfo, param.bindingField);
        if (value !== undefined) {
          paramValues[param.name] = String(value);
          continue;
        }
      }
      if (param.defaultValue) {
        paramValues[param.name] = param.defaultValue;
      }
    }
    
    // 覆盖输入值
    if (inputParams) {
      Object.assign(paramValues, inputParams);
    }

    // 渲染提示词（替换占位符）
    let renderedPrompt = template.content;
    let renderedSystemPrompt = template.systemPrompt || '';

    // 替换参数占位符 {{param}}
    for (const [key, value] of Object.entries(paramValues)) {
      const placeholder = `{{${key}}}`;
      renderedPrompt = renderedPrompt.replace(new RegExp(placeholder, 'g'), value);
      renderedSystemPrompt = renderedSystemPrompt.replace(new RegExp(placeholder, 'g'), value);
    }

    // 检查是否有未填充的必填参数
    const unfilledParams = paramDefs
      .filter(p => p.isRequired && !paramValues[p.name])
      .map(p => p.label);
    
    if (unfilledParams.length > 0) {
      return NextResponse.json(
        { error: `缺少必填参数：${unfilledParams.join('、')}` },
        { status: 400 }
      );
    }

    // 创建生成记录
    const [generation] = await db
      .insert(schemeGenerations)
      .values({
        projectId: projectId || null,
        templateId,
        templateVersion: template.currentVersion,
        parameters: JSON.stringify(paramValues),
        status: 'generating',
        modelProvider: template.modelProvider,
        modelName: template.modelName,
        createdBy: currentUser.userId,
      })
      .returning();

    // 选择LLM适配器
    let llm;
    if (template.modelProvider) {
      llm = getLLMByProvider(template.modelProvider as LLMProvider);
    } else {
      llm = getLLM();
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    
    // 添加系统提示词
    if (renderedSystemPrompt) {
      messages.push({ role: 'system' as const, content: renderedSystemPrompt });
    }
    
    // 添加用户提示词
    messages.push({ role: 'user' as const, content: renderedPrompt });

    // 生成配置
    const options: any = {};
    if (template.modelName) options.model = template.modelName;
    if (template.temperature) options.temperature = parseFloat(template.temperature);
    if (template.maxTokens) options.maxTokens = template.maxTokens;
    options.signal = request.signal; // P1 优化：将请求信号透传给适配器，确保立即切断连接

    if (stream) {
      // 流式响应
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let fullContent = '';
          let usage: any = null;
          const startTime = Date.now();

          try {
            for await (const chunk of llm.generateStream(messages, options)) {
              // P1 优化：检查请求是否已中断
              if (request.signal.aborted) {
                console.log('Client aborted prompt generation');
                break;
              }

              if (chunk.content) {
                fullContent += chunk.content;
                // 发送SSE格式的数据
                const data = JSON.stringify({ type: 'content', content: chunk.content });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
              if (chunk.usage) {
                usage = chunk.usage;
              }
              if (chunk.done) {
                const data = JSON.stringify({ 
                  type: 'done', 
                  finishReason: chunk.finishReason,
                  usage: chunk.usage 
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            }

            // 只有在未中断的情况下才更新生成记录
            if (!request.signal.aborted) {
              await db
                .update(schemeGenerations)
                .set({
                  title: paramValues.title || paramValues.projectName || `方案_${generation.id}`,
                  content: fullContent,
                  status: 'completed',
                  promptTokens: usage?.promptTokens,
                  completionTokens: usage?.completionTokens,
                  totalTokens: usage?.totalTokens,
                  duration: Date.now() - startTime,
                  updatedAt: new Date(),
                })
                .where(eq(schemeGenerations.id, generation.id));

              // 更新模板使用次数
              await db
                .update(promptTemplates)
                .set({ 
                  useCount: template.useCount + 1,
                  updatedAt: new Date() 
                })
                .where(eq(promptTemplates.id, templateId));
            } else {
              // 如果中断了，标记为失败或取消
              await db
                .update(schemeGenerations)
                .set({
                  status: 'failed',
                  updatedAt: new Date(),
                })
                .where(eq(schemeGenerations.id, generation.id));
            }
          } catch (error) {
            console.error('Prompt generation error:', error);
            if (!request.signal.aborted) {
              const errorMessage = error instanceof Error ? error.message : '生成失败';
              
              await db
                .update(schemeGenerations)
                .set({
                  status: 'failed',
                  errorMessage,
                  updatedAt: new Date(),
                })
                .where(eq(schemeGenerations.id, generation.id));

              const data = JSON.stringify({ type: 'error', error: errorMessage });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // 非流式响应
      const startTime = Date.now();
      
      try {
        const result = await llm.generate(messages, options);

        // 更新生成记录
        await db
          .update(schemeGenerations)
          .set({
            title: paramValues.title || paramValues.projectName || `方案_${generation.id}`,
            content: result.content,
            status: 'completed',
            promptTokens: result.usage?.promptTokens,
            completionTokens: result.usage?.completionTokens,
            totalTokens: result.usage?.totalTokens,
            duration: Date.now() - startTime,
            updatedAt: new Date(),
          })
          .where(eq(schemeGenerations.id, generation.id));

        // 更新模板使用次数
        await db
          .update(promptTemplates)
          .set({ 
            useCount: template.useCount + 1,
            updatedAt: new Date() 
          })
          .where(eq(promptTemplates.id, templateId));

        return NextResponse.json({
          success: true,
          generationId: generation.id,
          content: result.content,
          finishReason: result.finishReason,
          usage: result.usage,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '生成失败';
        
        await db
          .update(schemeGenerations)
          .set({
            status: 'failed',
            errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(schemeGenerations.id, generation.id));

        return NextResponse.json(
          { error: errorMessage },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error('生成方案失败:', error);
    return NextResponse.json(
      { error: '生成方案失败' },
      { status: 500 }
    );
  }
}

// ============================================
// GET: 预览渲染后的提示词
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const templateId = searchParams.get('templateId');
    const paramsStr = searchParams.get('params');

    if (!templateId) {
      return NextResponse.json({ error: '缺少模板ID' }, { status: 400 });
    }

    // 获取模板
    const [template] = await db
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.id, parseInt(templateId)));

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    // 解析参数
    const inputParams = paramsStr ? JSON.parse(paramsStr) : {};

    // 渲染提示词
    let renderedPrompt = template.content;
    let renderedSystemPrompt = template.systemPrompt || '';

    for (const [key, value] of Object.entries(inputParams)) {
      const placeholder = `{{${key}}}`;
      renderedPrompt = renderedPrompt.replace(new RegExp(placeholder, 'g'), String(value));
      renderedSystemPrompt = renderedSystemPrompt.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return NextResponse.json({
      prompt: renderedPrompt,
      systemPrompt: renderedSystemPrompt,
    });
  } catch (error) {
    console.error('预览提示词失败:', error);
    return NextResponse.json(
      { error: '预览提示词失败' },
      { status: 500 }
    );
  }
}

// 辅助函数：获取嵌套对象值
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current?.[key];
  }, obj);
}

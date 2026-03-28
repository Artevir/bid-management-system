# 基于 Next\.js 15 \+ TS \+ PostgreSQL \+ Drizzle 的 AI 代码全项目评审方案

# 基于Next\.js 15\+TS\+PostgreSQL\+Drizzle的AI代码全项目评审方案

针对你指定的技术栈（Next\.js 15 \+ TypeScript \+ PostgreSQL \+ Drizzle ORM \+ LLM SDK），我设计了一套**定制化自动化评审方案**，核心是「技术栈专属规则\+静态分析\+动态验证\+LLM逻辑推理」的四层校验体系，可直接集成到AI Coding平台的代码生成后流程中，自动检测语法、规范、常规错误和逻辑漏洞。

## 一、评审方案整体流程

整个自动化评审流程围绕技术栈特性定制，覆盖从基础语法到业务逻辑的全维度校验：

```Plaintext
graph TD
    A[AI生成代码交付] --> B[1. 技术栈基础校验]
    B --> C[2. 代码规范自动化校验]
    C --> D[3. 常规错误检测（静态+动态）]
    D --> E[4. 业务逻辑&LLM/Drizzle逻辑验证]
    E --> F[生成结构化评审报告]
    F --> G{是否通过}
    G -->|否| H[AI自动修复+问题反馈]
    G -->|是| I[代码交付/部署]
    
    B --> B1[TS类型校验]
    B --> B2[Next.js 15配置校验]
    B --> B3[Drizzle语法校验]
    B --> B4[PostgreSQL连接校验]
    
    D --> D1[ESLint/TypeScript静态分析]
    D --> D2[单元测试自动生成&执行]
    D --> D3[数据库迁移验证]
    
    E --> E1[LLM SDK调用逻辑校验]
    E --> E2[Next.js路由/数据获取逻辑]
    E --> E3[Drizzle ORM查询逻辑]
    E --> E4[全项目集成测试]
```

## 二、各层评审具体实现（可落地代码\+工具）

### 1\. 技术栈基础校验（第一层）

**目标**：检测TS类型错误、Next\.js 15配置错误、Drizzle语法错误、PostgreSQL连接合法性
**核心依赖**：`typescript`、`next`、`drizzle\-kit`、`pg`
**实现代码**：

```TypeScript
// review/core/basic-validator.ts
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { loadEnvConfig } from '@next/env';

// 加载Next.js环境变量
loadEnvConfig(process.cwd());

interface BasicCheckResult {
  pass: boolean;
  errors: Array<{ type: string; message: string; file?: string }>;
}

/**
 * TypeScript类型校验
 */
async function checkTypeScript(projectDir: string): Promise<BasicCheckResult> {
  const result: BasicCheckResult = { pass: true, errors: [] };
  try {
    // 执行tsc类型检查（仅检查不编译）
    execSync(`cd ${projectDir} && npx tsc --noEmit`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
  } catch (error: any) {
    result.pass = false;
    // 解析TS类型错误
    const errors = error.stdout?.split('\n').filter(Boolean) || [];
    errors.forEach((err) => {
      if (err.includes('error TS')) {
        result.errors.push({
          type: 'TypeScript Error',
          message: err.trim(),
          file: err.split(':')[0] || undefined,
        });
      }
    });
  }
  return result;
}

/**
 * Next.js 15配置校验
 */
async function checkNextConfig(projectDir: string): Promise<BasicCheckResult> {
  const result: BasicCheckResult = { pass: true, errors: [] };
  const nextConfigPath = path.join(projectDir, 'next.config.ts');
  
  try {
    // 检查配置文件是否存在且合法
    await fs.access(nextConfigPath);
    // 验证Next.js 15特有配置（如React 19兼容、App Router等）
    const configContent = await fs.readFile(nextConfigPath, 'utf-8');
    if (configContent.includes('experimental.appDir') && !configContent.includes('appDir: true')) {
      result.errors.push({
        type: 'Next.js Config Error',
        message: 'Next.js 15中App Router需显式启用 appDir: true',
        file: nextConfigPath,
      });
    }
    // 检查React版本兼容性（Next.js 15要求React 19+）
    const packageJson = JSON.parse(await fs.readFile(path.join(projectDir, 'package.json'), 'utf-8'));
    const reactVersion = packageJson.dependencies?.react || packageJson.devDependencies?.react;
    if (reactVersion && !reactVersion.startsWith('19.')) {
      result.errors.push({
        type: 'Next.js Dependency Error',
        message: `Next.js 15要求React 19+，当前版本：${reactVersion}`,
        file: 'package.json',
      });
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      result.errors.push({
        type: 'Next.js Config Error',
        message: 'next.config.ts 文件不存在',
        file: nextConfigPath,
      });
    } else {
      result.errors.push({
        type: 'Next.js Config Error',
        message: `配置文件解析失败：${error.message}`,
        file: nextConfigPath,
      });
    }
    result.pass = false;
  }
  return result;
}

/**
 * Drizzle ORM语法&配置校验
 */
async function checkDrizzle(projectDir: string): Promise<BasicCheckResult> {
  const result: BasicCheckResult = { pass: true, errors: [] };
  const drizzleConfigPath = path.join(projectDir, 'drizzle.config.ts');
  
  try {
    // 检查Drizzle配置文件
    await fs.access(drizzleConfigPath);
    // 执行drizzle-kit校验
    execSync(`cd ${projectDir} && npx drizzle-kit check`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
  } catch (error: any) {
    result.pass = false;
    result.errors.push({
      type: 'Drizzle Error',
      message: error.stdout || error.message,
      file: drizzleConfigPath,
    });
  }

  // 校验Drizzle schema语法
  const schemaDir = path.join(projectDir, 'src/db/schema');
  try {
    await fs.access(schemaDir);
    execSync(`cd ${projectDir} && npx tsc ${schemaDir}/*.ts --noEmit`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
  } catch (error: any) {
    result.pass = false;
    result.errors.push({
      type: 'Drizzle Schema Error',
      message: error.stdout || error.message,
      file: schemaDir,
    });
  }
  return result;
}

/**
 * PostgreSQL连接校验（仅测试连接，不执行读写）
 */
async function checkPostgresConnection(): Promise<BasicCheckResult> {
  const result: BasicCheckResult = { pass: true, errors: [] };
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    await client.query('SELECT 1'); // 测试连接
  } catch (error: any) {
    result.pass = false;
    result.errors.push({
      type: 'PostgreSQL Connection Error',
      message: `数据库连接失败：${error.message}`,
    });
  } finally {
    await client.end();
  }
  return result;
}

/**
 * 基础校验入口
 */
export async function runBasicChecks(projectDir: string): Promise<BasicCheckResult> {
  const finalResult: BasicCheckResult = { pass: true, errors: [] };
  
  // 依次执行各基础校验
  const checks = [
    { name: 'TypeScript', fn: () => checkTypeScript(projectDir) },
    { name: 'Next.js Config', fn: () => checkNextConfig(projectDir) },
    { name: 'Drizzle ORM', fn: () => checkDrizzle(projectDir) },
    { name: 'PostgreSQL Connection', fn: () => checkPostgresConnection() },
  ];

  for (const check of checks) {
    const res = await check.fn();
    if (!res.pass) {
      finalResult.pass = false;
      finalResult.errors.push(...res.errors.map(err => ({
        ...err,
        category: check.name,
      })));
    }
  }

  return finalResult;
}
```

### 2\. 代码规范校验（第二层）

**目标**：检测符合Next\.js/TS/Drizzle生态的代码规范问题
**核心依赖**：`eslint`、`prettier`、`eslint\-config\-next`、`eslint\-plugin\-drizzle`
**实现步骤\+代码**：

#### 第一步：配置专属ESLint规则（\.eslintrc\.json）

```JSON
{
  "extends": [
    "next/core-web-vitals",
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:drizzle/recommended"
  ],
  "plugins": ["@typescript-eslint", "drizzle"],
  "rules": {
    // Next.js 15专属规则
    "@next/next/no-html-link-for-pages": "error",
    "react-hooks/rules-of-hooks": "error",
    // TypeScript严格规则
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "error",
    // Drizzle规则
    "drizzle/enforce-delete-with-where": "error",
    "drizzle/enforce-update-with-where": "error",
    // 通用规范
    "indent": ["error", 2],
    "semi": ["error", "always"],
    "quotes": ["error", "single"]
  }
}
```

#### 第二步：自动化规范校验代码

```TypeScript
// review/core/style-validator.ts
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

interface StyleCheckResult {
  pass: boolean;
  errors: Array<{ file: string; message: string; line: number }>;
  warnings: Array<{ file: string; message: string; line: number }>;
}

/**
 * 执行ESLint+Prettier规范校验
 */
export async function runStyleChecks(projectDir: string): Promise<StyleCheckResult> {
  const result: StyleCheckResult = { pass: true, errors: [], warnings: [] };
  
  // 1. 检查ESLint配置是否存在
  const eslintConfigPath = path.join(projectDir, '.eslintrc.json');
  try {
    await fs.access(eslintConfigPath);
  } catch {
    result.pass = false;
    result.errors.push({
      file: eslintConfigPath,
      message: 'ESLint配置文件缺失',
      line: 0,
    });
    return result;
  }

  try {
    // 执行ESLint校验（输出JSON格式便于解析）
    const eslintOutput = execSync(
      `cd ${projectDir} && npx eslint . --ext .ts,.tsx --format json`,
      { stdio: 'pipe', encoding: 'utf-8' }
    );
    const eslintResults = JSON.parse(eslintOutput);

    // 解析ESLint结果
    eslintResults.forEach((fileResult: any) => {
      const filePath = fileResult.filePath;
      fileResult.messages.forEach((msg: any) => {
        const entry = {
          file: filePath,
          message: `${msg.ruleId}: ${msg.message}`,
          line: msg.line,
        };
        if (msg.severity === 2) { // 错误
          result.pass = false;
          result.errors.push(entry);
        } else if (msg.severity === 1) { // 警告
          result.warnings.push(entry);
        }
      });
    });

    // 2. Prettier格式校验
    const prettierOutput = execSync(
      `cd ${projectDir} && npx prettier --check .`,
      { stdio: 'pipe', encoding: 'utf-8', stdio: 'pipe' }
    );
    const prettierLines = prettierOutput.split('\n').filter(Boolean);
    prettierLines.forEach(line => {
      if (line.startsWith('Checking formatting...')) return;
      if (line.startsWith('All matched files use Prettier formatting')) return;
      if (line.includes('Code style issues found in the above file(s)')) return;
      
      // 解析格式错误
      const [filePath, ...rest] = line.split(': ');
      if (filePath && rest.length) {
        result.pass = false;
        result.errors.push({
          file: filePath.trim(),
          message: `Prettier格式错误：${rest.join(': ')}`,
          line: 0,
        });
      }
    });
  } catch (error: any) {
    result.pass = false;
    result.errors.push({
      file: 'global',
      message: `规范校验执行失败：${error.stdout || error.message}`,
      line: 0,
    });
  }

  return result;
}
```

### 3\. 常规错误检测（第三层）

**目标**：检测运行时错误、数据库操作错误、LLM SDK调用错误等
**核心手段**：单元测试自动生成\+执行、数据库迁移验证、API调用模拟
**实现代码**：

```TypeScript
// review/core/error-detector.ts
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { generateUnitTests } from './llm-test-generator'; // 下文实现

interface ErrorCheckResult {
  pass: boolean;
  testResults: { passed: number; failed: number; errors: Array<{ test: string; error: string }> };
  migrationErrors: string[];
  llmSdkErrors: string[];
}

/**
 * 自动生成并执行单元测试
 */
async function runAutoUnitTests(projectDir: string): Promise<ErrorCheckResult['testResults']> {
  const testDir = path.join(projectDir, 'src/__tests__');
  await fs.mkdir(testDir, { recursive: true });

  // 1. 用LLM SDK生成针对核心文件的单元测试（覆盖Drizzle/LLM/Next.js逻辑）
  const coreFiles = [
    path.join(projectDir, 'src/db/index.ts'), // Drizzle核心
    path.join(projectDir, 'src/app/api/chat/route.ts'), // LLM SDK调用
    path.join(projectDir, 'src/app/page.tsx'), // Next.js页面逻辑
  ];
  for (const file of coreFiles) {
    try {
      const fileContent = await fs.readFile(file, 'utf-8');
      // 调用LLM SDK生成测试代码（示例：OpenAI SDK）
      const testCode = await generateUnitTests(fileContent, path.basename(file));
      const testFilePath = path.join(testDir, `${path.basename(file)}.test.ts`);
      await fs.writeFile(testFilePath, testCode);
    } catch (error: any) {
      console.warn(`生成测试失败 ${file}: ${error.message}`);
    }
  }

  // 2. 执行Jest测试
  const testResult = { passed: 0, failed: 0, errors: [] };
  try {
    const jestOutput = execSync(
      `cd ${projectDir} && npx jest --json`,
      { stdio: 'pipe', encoding: 'utf-8' }
    );
    const jestJson = JSON.parse(jestOutput);
    
    testResult.passed = jestJson.numPassedTests || 0;
    testResult.failed = jestJson.numFailedTests || 0;
    
    // 解析失败的测试用例
    if (jestJson.testResults) {
      jestJson.testResults.forEach((result: any) => {
        if (result.failureMessages.length) {
          result.failureMessages.forEach((msg: string) => {
            testResult.errors.push({
              test: result.name,
              error: msg,
            });
          });
        }
      });
    }
  } catch (error: any) {
    testResult.failed += 1;
    testResult.errors.push({
      test: 'global',
      error: `测试执行失败：${error.stdout || error.message}`,
    });
  }

  return testResult;
}

/**
 * 验证Drizzle数据库迁移
 */
async function checkDrizzleMigrations(projectDir: string): Promise<string[]> {
  const errors: string[] = [];
  try {
    // 执行迁移校验（不实际修改数据库）
    execSync(`cd ${projectDir} && npx drizzle-kit migrate --dry-run`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
  } catch (error: any) {
    errors.push(`Drizzle迁移错误：${error.stdout || error.message}`);
  }
  return errors;
}

/**
 * 校验LLM SDK调用逻辑（模拟调用）
 */
async function checkLlmSdkLogic(projectDir: string): Promise<string[]> {
  const errors: string[] = [];
  const llmFiles = await fs.readdir(path.join(projectDir, 'src/app/api'), { recursive: true });
  
  for (const file of llmFiles) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    const filePath = path.join(projectDir, 'src/app/api', file);
    const content = await fs.readFile(filePath, 'utf-8');
    
    // 检查常见LLM SDK错误：缺少API Key、未处理超时、未捕获异常
    if (content.includes('process.env.OPENAI_API_KEY') && !content.includes('if (!process.env.OPENAI_API_KEY)')) {
      errors.push(`${filePath}: 未校验LLM API Key是否存在`);
    }
    if (content.includes('openai.chat.completions.create') && !content.includes('timeout')) {
      errors.push(`${filePath}: LLM SDK调用未设置超时`);
    }
    if (content.includes('openai.') && !content.includes('try {') && !content.includes('.catch(')) {
      errors.push(`${filePath}: LLM SDK调用未捕获异常`);
    }
  }
  return errors;
}

/**
 * 常规错误检测入口
 */
export async function runErrorChecks(projectDir: string): Promise<ErrorCheckResult> {
  const testResults = await runAutoUnitTests(projectDir);
  const migrationErrors = await checkDrizzleMigrations(projectDir);
  const llmSdkErrors = await checkLlmSdkLogic(projectDir);

  return {
    pass: testResults.failed === 0 && migrationErrors.length === 0 && llmSdkErrors.length === 0,
    testResults,
    migrationErrors,
    llmSdkErrors,
  };
}
```

### 4\. 业务逻辑验证（第四层）

**目标**：检测Next\.js路由逻辑、Drizzle查询逻辑、LLM交互逻辑的业务漏洞
**核心实现**：LLM驱动的逻辑推理\+集成测试

```TypeScript
// review/core/logic-validator.ts
import { OpenAI } from 'openai';
import fs from 'fs/promises';
import path from 'path';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface LogicCheckResult {
  pass: boolean;
  logicErrors: Array<{ file: string; issue: string; suggestion: string }>;
}

/**
 * 用LLM分析代码逻辑漏洞
 */
async function analyzeLogicWithLLM(projectDir: string): Promise<LogicCheckResult> {
  const result: LogicCheckResult = { pass: true, logicErrors: [] };
  
  // 收集核心业务文件
  const coreFiles = [
    { path: path.join(projectDir, 'src/db/schema.ts'), type: 'Drizzle数据库Schema' },
    { path: path.join(projectDir, 'src/app/api/chat/route.ts'), type: 'LLM SDK交互逻辑' },
    { path: path.join(projectDir, 'src/app/(auth)/login/route.ts'), type: 'Next.js认证逻辑' },
    { path: path.join(projectDir, 'src/lib/llm/utils.ts'), type: 'LLM响应处理逻辑' },
  ];

  for (const { path: filePath, type } of coreFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // 调用LLM进行逻辑评审
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `你是资深的Next.js 15 + TypeScript + Drizzle ORM + PostgreSQL + LLM SDK专家，需要评审代码的逻辑正确性。
            重点检查：
            1. Next.js 15 App Router数据获取逻辑（如fetch、server components）是否正确
            2. Drizzle ORM查询是否有逻辑漏洞（如未加索引、N+1查询、无where的delete/update）
            3. PostgreSQL交互是否有性能/安全问题（如SQL注入风险）
            4. LLM SDK调用是否有逻辑错误（如参数错误、响应处理不当、缺少重试机制）
            5. TypeScript类型逻辑是否自洽
            输出格式：JSON数组，每个元素包含issue（问题描述）和suggestion（修复建议），无问题则返回空数组。`,
          },
          {
            role: 'user',
            content: `请评审以下${type}代码的逻辑错误：\n\n${content}`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      // 解析LLM返回的逻辑问题
      const llmResponse = JSON.parse(completion.choices[0].message.content || '{"errors": []}');
      if (llmResponse.errors && llmResponse.errors.length > 0) {
        result.pass = false;
        llmResponse.errors.forEach((err: any) => {
          result.logicErrors.push({
            file: filePath,
            issue: err.issue,
            suggestion: err.suggestion,
          });
        });
      }
    } catch (error: any) {
      result.logicErrors.push({
        file: filePath,
        issue: `逻辑分析失败：${error.message}`,
        suggestion: '检查文件是否存在且内容合法',
      });
    }
  }

  return result;
}

/**
 * 业务逻辑验证入口
 */
export async function runLogicChecks(projectDir: string): Promise<LogicCheckResult> {
  return await analyzeLogicWithLLM(projectDir);
}
```

### 5\. LLM测试生成工具（配套实现）

```TypeScript
// review/core/llm-test-generator.ts
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * 调用LLM生成单元测试代码
 */
export async function generateUnitTests(code: string, fileName: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `你是专业的TypeScript/Next.js/Drizzle测试工程师，需要为给定代码生成Jest单元测试。
        要求：
        1. 测试代码符合Jest规范，可直接执行
        2. 覆盖核心逻辑分支，包括异常场景
        3. 模拟PostgreSQL/Drizzle/LLM SDK依赖（使用jest.mock）
        4. 输出仅返回测试代码，无其他解释`,
      },
      {
        role: 'user',
        content: `为以下代码生成Jest单元测试（文件名为${fileName}）：\n\n${code}`,
      },
    ],
  });

  return completion.choices[0].message.content || '';
}
```

### 6\. 全项目评审入口（整合所有校验）

```TypeScript
// review/index.ts
import { runBasicChecks } from './core/basic-validator';
import { runStyleChecks } from './core/style-validator';
import { runErrorChecks } from './core/error-detector';
import { runLogicChecks } from './core/logic-validator';
import fs from 'fs/promises';

interface FullReviewResult {
  overallPass: boolean;
  basic: Awaited<ReturnType<typeof runBasicChecks>>;
  style: Awaited<ReturnType<typeof runStyleChecks>>;
  errors: Awaited<ReturnType<typeof runErrorChecks>>;
  logic: Awaited<ReturnType<typeof runLogicChecks>>;
  report: string;
}

/**
 * 全项目代码评审主入口
 */
export async function runFullCodeReview(projectDir: string): Promise<FullReviewResult> {
  console.log('开始全项目代码评审...');
  
  // 1. 执行各层校验
  const basicResult = await runBasicChecks(projectDir);
  const styleResult = await runStyleChecks(projectDir);
  const errorResult = await runErrorChecks(projectDir);
  const logicResult = await runLogicChecks(projectDir);

  // 2. 生成结构化评审报告
  const overallPass = basicResult.pass && styleResult.pass && errorResult.pass && logicResult.pass;
  const report = `
# AI Coding平台代码评审报告
## 整体结果：${overallPass ? '通过' : '未通过'}

### 1. 基础校验
- 结果：${basicResult.pass ? '通过' : '未通过'}
- 错误数：${basicResult.errors.length}
${basicResult.errors.map(e => `- ${e.category}: ${e.message} (${e.file || '全局'})`).join('\n')}

### 2. 代码规范
- 结果：${styleResult.pass ? '通过' : '未通过'}
- 错误数：${styleResult.errors.length}
- 警告数：${styleResult.warnings.length}
${styleResult.errors.map(e => `- ${e.file}:${e.line} ${e.message}`).join('\n')}

### 3. 常规错误
- 单元测试：通过${errorResult.testResults.passed}个 / 失败${errorResult.testResults.failed}个
- 数据库迁移错误：${errorResult.migrationErrors.length}个
- LLM SDK错误：${errorResult.llmSdkErrors.length}个

### 4. 逻辑错误
- 结果：${logicResult.pass ? '通过' : '未通过'}
${logicResult.logicErrors.map(e => `- ${e.file}: ${e.issue}\n  修复建议：${e.suggestion}`).join('\n')}
  `;

  // 保存评审报告
  await fs.writeFile(path.join(projectDir, 'code-review-report.md'), report);

  return {
    overallPass,
    basic: basicResult,
    style: styleResult,
    errors: errorResult,
    logic: logicResult,
    report,
  };
}

// 示例调用
// runFullCodeReview('/path/to/your/nextjs-project').then(result => {
//   console.log('评审完成：', result.overallPass ? '通过' : '未通过');
//   console.log('报告已保存到 code-review-report.md');
// });
```

## 三、环境配置与依赖

### 1\. 必要依赖安装

```Bash
# 基础依赖
npm install -D typescript @types/node eslint prettier jest @types/jest ts-jest
# Next.js/ESLint配置
npm install -D eslint-config-next eslint-plugin-react-hooks @typescript-eslint/eslint-plugin @typescript-eslint/parser
# Drizzle校验
npm install -D drizzle-kit eslint-plugin-drizzle
# PostgreSQL客户端
npm install pg @types/pg
# LLM SDK（以OpenAI为例）
npm install openai @types/openai
```

### 2\. 环境变量配置（\.env）

```Plaintext
# PostgreSQL配置
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-password
POSTGRES_DB=your-db

# LLM SDK配置（用于逻辑分析和测试生成）
OPENAI_API_KEY=your-openai-api-key
```

## 四、集成到AI Coding平台的建议

1. **触发时机**：AI生成代码完成后，自动调用`runFullCodeReview`函数；

2. **失败处理**：评审未通过时，将报告中的问题反馈给AI，让AI自动修复代码后重新评审；

3. **规则定制**：可根据团队规范修改ESLint规则、LLM评审提示词；

4. **性能优化**：对大型项目可分模块评审，优先校验核心文件；

5. **报告展示**：将结构化报告以可视化方式展示在平台上，标注错误位置和修复建议。

## 总结

### 核心要点回顾

1. **分层校验体系**：基础校验（TS/Next\.js/Drizzle/PG）→ 规范校验（ESLint/Prettier）→ 常规错误（单元测试/迁移校验）→ 逻辑校验（LLM驱动），覆盖所有评审维度；

2. **技术栈专属规则**：针对Next\.js 15 App Router、Drizzle ORM、LLM SDK设计定制化校验逻辑，解决通用评审工具的适配问题；

3. **LLM双轮驱动**：用LLM自动生成单元测试\+分析业务逻辑，既解决了测试覆盖问题，又能检测传统工具无法发现的逻辑漏洞。

这套方案可直接集成到AI Coding平台，实现代码生成后的全自动评审，大幅降低人工介入成本，同时保证代码质量符合技术栈最佳实践。

> （注：文档部分内容可能由 AI 生成）

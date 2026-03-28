/**
 * 文档相关类型定义
 */

// 文档密级
export type DocumentSecurityLevel =
  | 'public'       // 公开
  | 'internal'     // 内部
  | 'confidential' // 机密
  | 'secret';      // 绝密

// 文档密级标签映射
export const DOCUMENT_SECURITY_LABELS: Record<DocumentSecurityLevel, string> = {
  public: '公开',
  internal: '内部',
  confidential: '机密',
  secret: '绝密',
};

// 文档密级颜色映射
export const DOCUMENT_SECURITY_COLORS: Record<DocumentSecurityLevel, string> = {
  public: 'green',
  internal: 'blue',
  confidential: 'orange',
  secret: 'red',
};

// 文档密级等级（数字越大，密级越高）
export const DOCUMENT_SECURITY_LEVELS: Record<DocumentSecurityLevel, number> = {
  public: 1,
  internal: 2,
  confidential: 3,
  secret: 4,
};

// 文件分类类型
export type FileCategoryType =
  | 'tender_doc'   // 招标文件
  | 'response_doc' // 响应文件
  | 'reference'    // 参考资料
  | 'knowledge'    // 知识文档
  | 'template'     // 模板文件
  | 'attachment';  // 附件

// 文件分类标签映射
export const FILE_CATEGORY_LABELS: Record<FileCategoryType, string> = {
  tender_doc: '招标文件',
  response_doc: '响应文件',
  reference: '参考资料',
  knowledge: '知识文档',
  template: '模板文件',
  attachment: '附件',
};

// 文件状态
export type FileStatus =
  | 'active'   // 正常
  | 'archived' // 已归档
  | 'deleted'; // 已删除

// 文件状态标签映射
export const FILE_STATUS_LABELS: Record<FileStatus, string> = {
  active: '正常',
  archived: '已归档',
  deleted: '已删除',
};

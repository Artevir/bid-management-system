/**
 * 标书业务 UI 常量
 */

export const BID_STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-500 hover:bg-gray-600' },
  editing: { label: '编辑中', color: 'bg-blue-500 hover:bg-blue-600' },
  reviewing: { label: '审批中', color: 'bg-yellow-500 hover:bg-yellow-600' },
  approved: { label: '已通过', color: 'bg-green-500 hover:bg-green-600' },
  rejected: { label: '已拒绝', color: 'bg-red-500 hover:bg-red-600' },
  published: { label: '已发布', color: 'bg-purple-500 hover:bg-purple-600' },
};

export const CHAPTER_TYPE_LABELS: Record<string, string> = {
  cover: '封面',
  toc: '目录',
  business: '商务部分',
  technical: '技术部分',
  qualification: '资格部分',
  price: '报价部分',
  appendix: '附录',
};

export const APPROVAL_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待处理', color: 'text-yellow-600 bg-yellow-50' },
  approved: { label: '已通过', color: 'text-green-600 bg-green-50' },
  rejected: { label: '已驳回', color: 'text-red-600 bg-red-50' },
  returned: { label: '已退回', color: 'text-gray-600 bg-gray-50' },
};

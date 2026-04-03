## 背景

在“上传招标文件 → 文件解读”流程中，前端会先为文件计算 MD5 并写入 `documentMd5`，用于服务端去重（数据库唯一索引 `bid_interpret_doc_md5_idx`）。

线上以 IP + HTTP 方式访问时（例如 `http://149.202.95.218:5000`），浏览器经常处于非安全上下文（non-secure context）。在这种情况下，`crypto.subtle` 可能不存在，导致前端在调用 `crypto.subtle.digest(...)` 时触发运行时错误，最终在页面上表现为：

`Cannot read properties of undefined (reading 'digest')`

## 根因

WebCrypto（`crypto.subtle`）在多数浏览器中只在安全上下文可用（例如 https、localhost）。当页面以 http + 公网 IP 访问时，`crypto.subtle` 可能为 `undefined`。

## 方案

在前端计算 MD5 的逻辑中：

1. 优先使用 `globalThis.crypto?.subtle?.digest` 计算 MD5（安全上下文可用时性能更好）。
2. 如果 `crypto.subtle` 不存在，则使用纯 JavaScript 实现计算 MD5（保证在非安全上下文也能生成稳定的内容哈希）。

这样可以避免退化为“文件名+大小+时间”的弱标识，从而减少误判与数据库唯一索引冲突。

## 代码位置

- 前端上传页：`src/app/interpretations/upload/page.tsx`
  - 函数：`calculateMd5(file: File)`
  - 新增：`md5ArrayBuffer(buffer: ArrayBuffer)` 作为非安全上下文兜底实现

## 发布验证

1. 在 HTTP + IP 访问方式下上传 `.doc/.docx/.pdf/.xls/.xlsx`
2. 点击“开始解析”
3. 预期：
   - 页面不再出现 `Cannot read properties of undefined (reading 'digest')`
   - 解读记录正常创建并进入解析流程

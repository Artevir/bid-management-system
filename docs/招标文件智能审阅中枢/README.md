# 招标文件智能审阅中枢 · 参考文档目录

本目录存放**智能审阅中枢**总装稿体系（**000–300** 号）的 **Word（.docx）** 与从 Word **自动生成的 Markdown（.md）**，并与上级 [`招标文件智能审阅中枢开发计划.md`](../招标文件智能审阅中枢开发计划.md) **V2.0** 对齐。

## 快速索引

- **全部 `.md` 链接表**：[INDEX.md](./INDEX.md)（与 `.docx` 同名一一对应）
- **开发计划（执行稿）**：[../招标文件智能审阅中枢开发计划.md](../招标文件智能审阅中枢开发计划.md)

## Markdown 是如何生成的

### 第一轮 / 第二轮（表格结构）

| 轮次       | 方式                                                   | 适用场景                                                                 |
| ---------- | ------------------------------------------------------ | ------------------------------------------------------------------------ | --- | ------------------------------------------------------ |
| **第一轮** | 内置 OOXML：顺序解析 `w:p` + `w:tbl`，表格为 GFM `     | 列                                                                       | `   | 不依赖 Pandoc；`gridSpan` 展开为列；**无**完整 rowspan |
| **第二轮** | **Pandoc**：`docx → GFM`，由 Pandoc 处理表格与部分版式 | 与 Word 表格更接近时；需本机有 `pandoc` 或仓库 `tools/pandoc/pandoc.exe` |

脚本：`scripts/docx-hub-to-markdown.py`。  
**默认优先第二轮（Pandoc）**；未找到或失败时**自动回退**第一轮。强制只用第一轮：设置 **`USE_PANDOC_FOR_DOCX=0`**（或 `false` / `no` / `off`）。

### 第一轮（内置，已含表格）

从 `word/document.xml` 解析：

- **段落**（`w:p`）：按顺序输出；
- **表格**（`w:tbl`）：GitHub 风格 Markdown；`w:gridSpan` 横向展开；`w:vMerge` 不模拟 rowspan；嵌套表/复杂版式以 Word 为准。

```bash
# 等价：pnpm docs:hub-md:native
USE_PANDOC_FOR_DOCX=0 python scripts/docx-hub-to-markdown.py
```

### 第二轮（默认首选：Pandoc）

1. **便携 Pandoc（推荐，目录已 gitignore）**  
   `pnpm docs:hub-md:install-pandoc`  
   或：`powershell -ExecutionPolicy Bypass -File scripts/install-pandoc-portable.ps1`  
   解压到 `tools/pandoc/`，脚本会**自动优先**使用该 `pandoc.exe`。
2. **系统安装**：MSI / `winget` 安装后加入 PATH，或设置 **`PANDOC_EXE`** 指向 `pandoc.exe`。

```bash
# 等价：pnpm docs:hub-md（默认即第二轮）
python scripts/docx-hub-to-markdown.py
```

仅当需要**显式**确认走 Pandoc 时，`pnpm docs:hub-md:pandoc` 与上式相同。

若需临时禁用 Pandoc（PowerShell）：

```powershell
$env:USE_PANDOC_FOR_DOCX = "0"
python scripts/docx-hub-to-markdown.py
```

### 两轮共用

- 自动在 `docs` 下查找包含 `000*.docx` 的目录（兼容目录名编码差异）。
- **跳过** Word 临时锁文件：`~$*.docx`。
- **输出目录**：始终为本目录 `docs/招标文件智能审阅中枢/`（UTF-8 标准路径）。

更新任意 `.docx` 后重新执行 `pnpm docs:hub-md`（或仅内置时 `pnpm docs:hub-md:native`）即可刷新对应 `.md` 与 `INDEX.md`。

## 法律效力与检索

| 用途                                  | 以谁为准         |
| ------------------------------------- | ---------------- |
| 评审签字、版式、表格、图示            | **原始 `.docx`** |
| 检索、Diff、IDE 内联阅读、AI 辅助摘要 | **同名的 `.md`** |

## 纳入仓库与只读路径

- **推荐**：将本目录下 `.docx` 与生成物 `.md` 一并纳入 Git；大文件可选用 [Git LFS](https://git-lfs.com/) 跟踪 `*.docx`。
- **替代**：通过环境变量 `TENDER_REVIEW_HUB_DOCS_PATH` 指向只读挂载目录存放 `.docx`，再在本地运行脚本将 `.md` 写回本目录（见仓库根目录 `.env.example` 注释）。

## 校验文件是否齐全

```powershell
Get-ChildItem -LiteralPath "docs/招标文件智能审阅中枢" -Filter "*.docx" | Measure-Object
Get-ChildItem -LiteralPath "docs/招标文件智能审阅中枢" -Filter "*.md" | Where-Object { $_.Name -ne "README.md" -and $_.Name -ne "INDEX.md" } | Measure-Object
```

（两者数量在「每个 docx 对应一个 md」时应一致；另含 `README.md`、`INDEX.md`。）

# Final submission provenance and source recovery

## 已确认的正式提交

| 项目 | 记录 |
|---|---|
| 课程 / 评估 | COM6103 / Team Project |
| 小组 | 1 eWaste |
| 提交尝试 | Attempt 1 |
| 页面显示提交时间 | 2026 年 5 月 7 日 01:13（UTC+8） |
| 原始附件名 | `1 eWaste.pdf` |
| 保存文件 | [COM6103_Team1_eWaste_Final_Report.pdf](../reports/COM6103_Team1_eWaste_Final_Report.pdf) |
| 文件大小 | 6,588,326 bytes |
| SHA-256 | `1cded5fef40262c3e30cb883781ca83a682f3e64c261ccac4e75fd23e37cdc37` |
| 提交要求 | “Please upload your Final report here in PDF format.” |
| 源码附件 | 此提交未附源码 ZIP |

来源为 [Blackboard 的 COM6103 Team Project 提交入口](https://vle.shef.ac.uk/ultra/courses/_123515_1/assessment/_9028411_1/overview)，通过已提交 Attempt 1 附件的 Download 菜单下载。该页面需要相应学校账户权限。

原始 PDF 未修改，共 16 个物理页面，双页排版包含封面及编号 1–31 的报告内容。此记录不包含成绩或评阅反馈。

The official report is verified and preserved. **Final source recovery is still incomplete.** The current repository contains the earlier March backend snapshot, whose features must not be conflated with the full prototype described in the report.

## 报告描述与现有源码

“报告描述”表示正式提交文件的内容；除明确标注的现有后端外，不代表已经取得对应源码或重新验证运行结果。

| 功能或交付物 | 正式报告描述 | 现有后端证据 | 恢复时应检查 |
|---|---|---|---|
| 前端 | React/Vite/TypeScript 用户、员工和管理员页面 | 无 `frontend/` | `frontend/package.json`、页面、静态资源及依赖记录 |
| 身份认证 | 本地登录、OAuth 配置及社交登录演示 | `auth.py` 实现邮箱密码与 JWT | 最终认证路由、前端回调、示例配置；演示登录与真实 OAuth 分开说明 |
| 设备提交和分类 | 结合年龄、需求和状态分为 current/recycle/rare/unknown/unwanted | `CollectionRequest` 只有基础物品字段与请求状态，没有分类规则 | 设备模型、年龄/需求字段、分类逻辑和相关测试 |
| 用户面板 | 展示设备、处理状态、年龄和市场需求 | `/api/requests/mine` 仅返回基础请求记录 | 前端面板和对应字段/API |
| 工作人员审核 | 未知设备队列、设备记录、分类和可见性管理 | 仅请求列表和通用状态修改 | 设备 CRUD、unknown 队列、权限检查 |
| 管理员用户管理 | 用户列表和角色更改 | 仅管理员 ping 与本地 `make_admin.py` | 管理接口和页面、角色变更行为 |
| 数据提取、付款、转介、擦除及报表 | 描述基础实体、API 和页面；部分集成未完成 | 无相应模型或模块 | 最终模型、迁移、接口、页面和外部服务的模拟/真实配置边界 |
| 后端测试 | 95 项 unittest 通过，用临时 SQLite 和模拟认证服务 | 无 `backend/tests/` | 原测试源文件、运行依赖和原始记录；恢复后才能复跑 |
| 前端检查 | 构建通过并有包体警告，lint 无诊断；无专门测试脚本 | 无前端项目 | `npm run build`、`npm run lint` 的实际配置和结果 |
| Windows 启动 | 自动准备数据库并启动前后端 | 无启动器 | `launcher/run.bat`、`launcher/public_demo.bat` |
| 示例配置 | 前后端 `.env.example`，一致的本地数据库路径 | 相应示例文件缺失 | `backend/.env.example`、`frontend/.env.example` 和实际数据库配置 |
| 团队过程材料 | GitLab 分支/MR、迭代和团队/TA/客户会议记录 | 未含最终团队过程材料 | 最终提交或原仓库实际包含的过程材料，不把未找到的记录描述为已归档 |


## 最终原型本身的限制

即使最终源码恢复，也必须保留正式报告写明的限制：完整 QR 转介和转售流程、稀有设备转售流程、正式邮件和云存储交付、付款沙盒回调的完整验证、用户侧数据擦除选择保存、专门的前端自动化测试、移动端适配及完整生产部署指南仍存在缺口。

报告中的 Google/GitHub 字样主要是 OAuth 功能；Facebook/Instagram 是演示登录。不能把按钮存在写成真实第三方登录已经配置完成。

## 测试证据范围

报告 §5.4–5.5 记录 `95 tests passed in 9.543s`，使用 Python unittest discovery、临时 SQLite 和必要的外部认证模拟。所列命令为：

```text
backend/.venv/bin/python -m unittest discover -s backend/tests -v
```

报告同时说明 pytest 当时未安装；前端构建通过但有包体大小警告，lint 未报告诊断，前端没有专门自动化测试脚本。现有后端快照不含 `backend/tests/` 或前端项目，本次归档未重跑这些检查。

## 团队归属与拼写

Blackboard 已确认 **Yongjiang Liu** 属于 `1 eWaste` 小组。正式 PDF 在封面与 §6.1 两处把前端成员写作 **Yongqiang Liu**。原提交稿保持不变，README 用已确认姓名并注明原稿差异。其他署名为 Dibing Bai、Ziwen Li、Yaqun Ma、Xuhao Zhou。

## GitLab 源码恢复线索

报告 §6.2 明确写团队使用 **GitLab** 管理代码、分支和 merge request。Appendix B 仅给出占位命令 `git clone <repository-url>`，没有真实克隆地址。

完整正文、超链接和全部 11 张独特内嵌图片的检查均未找到源码网址。官方 PDF 只有一个本机前端链接；图中的 GitHub 字样是登录/OAuth 功能，不能作为源码仓库地址。

登录后应先从可访问项目和群组寻找 `eWaste`、`eWaste Hub`、`COM6103`、`Team 1` 或 `Team 01`，再与成员及源码内容核对。当前 GitHub 原始提交的作者名 `yongjiangliu-uom` 只是账户线索，尚未证实为 GitLab 用户名。报告没有提供任何明确的组员 GitLab 用户名。

最终源码的强识别路径包括：

```text
frontend/package.json
frontend/.env.example
backend/.env.example
backend/tests/
launcher/run.bat
launcher/public_demo.bat
```

恢复后应保留团队原提交历史、作者和许可信息，记录最终分支/提交，再依据实际文件补充完整安装与复现步骤。不得以新编造的前端或接口冒充历史最终源码。

## 与先前本地副本的关系

此前本地 `1+eWaste.pdf` 的文件哈希不同，因为其 PDF 保存方式和元数据不同。比较结果显示：归一化全文、所有非空文本行及 13 个内嵌图片内容均与正式稿一致；14/16 个渲染页面逐像素一致，另两页只有极小的光栅差异。归档以 Blackboard 下载的正式文件为准。

## English summary

The official COM6103 Team 1 final PDF is recovered and checksum-verified. Blackboard required a report only; no source archive was attached. The available March backend implements authentication and basic collection-request operations. The final frontend, expanded workflow code, tests and launchers remain to be recovered from GitLab.

Features and test outcomes described in the final report are historical report evidence, not claims about the current backend snapshot or independently reproduced results. Team attribution and the original report are retained without silently correcting its name spelling.

# DSH personaSuffix：对话摘要与源码核查

- 采集日期：2026-11-05（北京时间）。
- 来源：用户关于 personaSuffix、主 SKILL.md 是否由代码读取的讨论，以及本次本地只读源码核查。
- 材料类型：非逐字对话摘要与源码观察。
- 业务仓库版本：ai-framework-template-career，HEAD `d418ded3b3046e59b62521a4014c4925b5b4fa89`；核查时工作区干净。
- 版本范围：requirements.txt 固定 `deepseek-harness-sdk==0.2.1rc2`；本地缓存 `@deepseek-ai/dsh-system-prompt` package.json 为 `0.2.1-rc.2`。
- 核验边界：没有调用模型、抓取本次部署的 HTTP 请求、更新 Skill 挂载或修改业务代码。本文不将源码注释里的历史实测当成本次验收。

## DSH 配置机制

`@deepseek-ai/dsh-system-prompt/lib/index.js` 中：

- Config 把 personaPrefix、personaSuffix 声明为字符串，默认空串。
- 构造函数将 personaSuffix 注册为 `deployment:persona-suffix` section，text 来自 config.personaSuffix。
- 默认顺序 `DEPLOYMENT_PERSONA_SUFFIX=10200`，在默认章节序列后部；不是独立 API 消息角色，也不是“绝对最后”或“最高优先级”的承诺。其他插件的顺序、作用域覆盖或 complete section 可以改变最终组装。
- `renderPrompt()` 按章节渲染并连接；通常支持已注册的 `{{variable}}` 插值。`assemble()` 可调用 section.text 函数和变量 provider。

因此，“配置值是字符串”不等于框架不能动态生成提示词；但把某个具体时刻写成普通文本不会自动变成时钟。personaSuffix 配置本身也不会主动读取 SKILL.md。

## 业务代码的主 Skill 注入

本次读取的源码位置：

- `app/biz/career/skills/k12_star_career.py:66`，`load_k12_star_career()`：通过 get_career_skill_dir() 定位目录，代码用 read_text 读取 SKILL.md，去除 YAML frontmatter，返回正文与 cwd。普通路径缺失文件会抛错。
- `app/biz/career/pooled_runner.py:85`，`_static_skill()`：普通模式调用上述加载器，不传学生信息和交互工具；计算 sha1 摘要，并将正文、cwd、digest 存入 `_STATIC_SKILL_CACHE`。
- `app/biz/career/dsh_runtime.py:66`，`_build_persona_patch()`：池创建/重建路径再用 read_text 读取 cwd/SKILL.md，去除 frontmatter，把正文写入 `/tmp/dsh_patches/persona_<digest>.yml`；同名 patch 已存在则不覆写。该函数单独遇到缺失文件会返回空串，但不代表前面的普通加载路径也能成功降级。
- `app/biz/career/dsh_runtime.py:178`，`get_career_dsh_pool()`：组装 patches，传给 DeepSeekHarnessConfig，工厂创建并启动 Harness。

patch 结构示意（示例文字，不是实际 Skill 全文）：

```yaml
- id: system-prompt
  config:
    personaSuffix: |
      你是生涯规划助手。
      按业务规则回答用户问题。
```

这条路径不经过模型的文件读取工具调用；模型收到提示词时，主 Skill 正文已经由业务代码提供。代码保证注入路径，不保证模型每次都正确遵循规则。Skill 引用的其他文件是否读取，需要单独检查加载器与工具调用；这里没有递归展开引用的实现证据。

## 缓存与时间

`_static_skill()` 只在 `_STATIC_SKILL_CACHE is None` 时加载；本次在 app 下检索，未发现其他重置赋值。池 key 包含 digest，但取的是缓存 digest，不能把“key 包含摘要”当成文件监听或热更新。

正常稳定文件场景下，应用初始化/首次创建池时完成加载，后续复用池与配置。更新挂载文件后，要让缓存重新加载并使新配置生效，例如重启应用进程；不能宣称只改文件就一定在下一请求生效。临时 patch 又以 digest 复用，因此也不应承诺重启必然覆盖所有异常缓存情形。

若正文写入“当前时间：14:05”，复用这段文本时仍是 14:05。动态 section/变量 provider 是另一个扩展机制，需要实现和接入；是否更新最终请求、是否保留旧值/事件，还应检查组装、适配器与会话投影，参见已有模型适配器笔记。

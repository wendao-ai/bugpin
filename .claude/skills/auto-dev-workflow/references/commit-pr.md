# 提交与 PR 具体命令（步骤 5）

> 项目特定的排除清单、Release 上传、PR body 模板、**DCO sign-off 强制**。SKILL.md 仅指明流程节点，命令在这里。

## 0. DCO Sign-off 硬性要求

BugPin 启用 Developer Certificate of Origin。**任何缺失 `Signed-off-by:` 行的 commit 都会被 GitHub DCO CI 拦截**。

- 在每条 `git commit` 命令中都必须带 `--signoff`（即 `-s`）
- 调用 `commit-commands:commit-push-pr` skill 时，args 中必须显式注明"必须 --signoff"
- 已忘记 sign-off 的本地 commit 可以用 `git commit --amend --signoff` 补救（未 push 前）
- 批量补救：`git rebase --signoff HEAD~N`（N 为提交数）

> 这条规则与用户 memory `feedback_dco_signoff.md` 一致。

## 5.1 PR 检测（避免重复创建）

```bash
EXISTING_PR=$(gh pr list --head "$(git branch --show-current)" --state open --json number,url)
if [ "$(echo "$EXISTING_PR" | jq 'length')" -gt 0 ]; then
  echo "已存在 PR，仅 commit + push："
  echo "$EXISTING_PR" | jq -r '.[0].url'
  SKIP_PR_CREATE=true
fi
```

若已有 PR，跳过 `commit-push-pr` skill，手动执行（注意 `--signoff`）：

```bash
git add -A \
  -- ':!**/node_modules/**' \
     ':!dist/**' \
     ':!data/**' \
     ':!*.db' ':!*.db-shm' ':!*.db-wal' \
     ':!test-results/**' \
     ':!.env' ':!.env.*' \
     ':!logs/**' \
     ':!**/.DS_Store'
git commit --signoff -m "<conventional commit, 中文>"
git push
```

## 5.2 提交（含 PR）

```
Skill("commit-commands:commit-push-pr",
  args="必须使用 git commit --signoff（DCO 强制）；conventional commit 中文风格，参考最近 git log；排除清单见 project-config.md")
```

应自动：
1. 创建分支（`feature/{kebab-desc}` 或 `fix/{kebab-desc}`）
2. 暂存相关文件（**排除清单见 `project-config.md`**）
3. 创建 conventional commit（**带 `--signoff`**，中文风格）
4. push 并 `gh pr create` 创建 PR

**提交后立即核验 sign-off**：

```bash
git log -1 --pretty=%B | grep -E "^Signed-off-by: " \
  || { echo "❌ 缺少 DCO sign-off，需 git commit --amend --signoff"; exit 1; }
```

## 5.3 截图上传到 PR 描述

`test-results/` 已 gitignore。通过临时 GitHub Release 托管：

```bash
PR_NUM=$(gh pr view --json number --jq .number)
TAG="screenshots-pr-${PR_NUM}"

git tag "$TAG"
git push origin "$TAG"
gh release create "$TAG" --title "Test screenshots for PR #$PR_NUM" \
  --notes "Temporary release; safe to delete after merge."

for img in "$TEST_RESULTS"/${SCREENSHOT_PREFIX}_*.png; do
  gh release upload "$TAG" "$img" --clobber
done

# 验证
ASSET_COUNT=$(gh release view "$TAG" --json assets --jq '.assets | length')
LOCAL_COUNT=$(ls "$TEST_RESULTS"/${SCREENSHOT_PREFIX}_*.png 2>/dev/null | wc -l | tr -d ' ')
[ "$ASSET_COUNT" = "$LOCAL_COUNT" ] || echo "⚠️ 上传不完整，需补传"
```

## 5.4 构建 PR body 并更新

```bash
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
BASE_URL="https://github.com/$REPO/releases/download/$TAG"

cat > /tmp/pr-body.md <<EOF
## 改动概述
<提取自 openspec/changes/<change-name>/proposal.md 的"Why / What Changes"段落>

## 测试证据

### 1. 初始状态
| | |
|:---:|:---:|
| ![01]($BASE_URL/${SCREENSHOT_PREFIX}_01-initial.png) | ![02]($BASE_URL/${SCREENSHOT_PREFIX}_02-after-input.png) |

### 2. 操作完成
| | |
|:---:|:---:|
| ![03]($BASE_URL/${SCREENSHOT_PREFIX}_03-submitted.png) | ![04]($BASE_URL/${SCREENSHOT_PREFIX}_04-result.png) |

## 验收要点
- [x] AC-1 ...
- [x] AC-2 ...

## 测试范围
- [ ] 后端单测：tests/server/ 全绿
- [ ] 类型检查：bun run typecheck 全绿
- [ ] 浏览器抽样：admin 主路由可访问、关键交互无报错
EOF

gh pr edit "$PR_NUM" --body-file /tmp/pr-body.md
```

> **录屏**（仅 clean 模式生成）：若 `${SCREENSHOT_PREFIX}_recording.webm` 存在，调用 `Skill("compound-engineering:feature-video")` 自动上传并嵌入 PR description。

> **清理（PR 合并后可选）**：`gh release delete $TAG -y && git push origin :$TAG && git tag -d $TAG`

---

## 当本文件需要更新

- 仓库迁出 GitHub（GitLab/Gitee 等）
- gh CLI 命令语法/字段变更
- 截图上传策略改变（如改用 S3/对象存储）
- PR body 模板调整（CI 集成、新审计要求）
- DCO 替换为 CLA 或取消

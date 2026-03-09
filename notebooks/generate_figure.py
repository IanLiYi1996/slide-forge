#!/usr/bin/env python3
"""
科研申请书配图一键生成脚本

用法:
  # 交互模式 — 按提示输入描述
  python generate_figure.py

  # 命令行模式 — 直接传参
  python generate_figure.py --desc "SDP增强摘要对比图..." --type comparison --lang zh

  # 使用内置预设
  python generate_figure.py --preset sdp_comparison
  python generate_figure.py --preset sdp_mechanism

  # 仅优化 prompt，不生成图片（用于手动微调）
  python generate_figure.py --desc "..." --prompt-only

依赖: boto3, Pillow (pip install boto3 Pillow)
"""

import argparse
import base64
import json
import os
import sys
import urllib.request
from datetime import datetime
from io import BytesIO
from pathlib import Path

from PIL import Image

# ── 加载 .env ────────────────────────────────────────────────────────────────

def load_env():
    """从脚本所在目录的上级查找 .env 文件并加载。"""
    candidates = [
        Path(__file__).resolve().parent.parent / ".env",  # slide-forge/.env
        Path(__file__).resolve().parent / ".env",          # notebooks/.env
        Path.cwd() / ".env",                               # 当前目录
    ]
    for p in candidates:
        if p.exists():
            for line in p.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    value = value.strip().strip('"').strip("'")
                    os.environ.setdefault(key.strip(), value)
            print(f"[env] Loaded {p}")
            return
    print("[env] No .env found — using existing environment variables")


load_env()

# ── 配置 ──────────────────────────────────────────────────────────────────────

YUNWU_API_KEY = os.environ.get("YUNWU_API_KEY", "")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
CLAUDE_MODEL_ID = os.environ.get(
    "ANTHROPIC_MODEL",
    "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
)
YUNWU_URL = "https://yunwu.ai/v1beta/models/gemini-3-pro-image-preview:generateContent"
OUTPUT_DIR = Path(__file__).resolve().parent / "output"

# ── 学术配图 System Prompt ────────────────────────────────────────────────────

ACADEMIC_BASE = """\
You are an expert at creating image generation prompts for
academic research proposal figures (科研基金申请书配图).

STRICT STYLE — academic, clean, print-friendly:
1. Output ONLY the prompt text. No explanations, no markdown, no quotes.
2. Pure white background (#FFFFFF). No background gradients, no dark backgrounds.
3. Flat, clean style. NO heavy gradients, NO glow effects, NO 3D, NO dark-themed cards.
4. Color usage — restrained and purposeful:
   - Borders and lines: medium blue (#3B82F6), medium gray (#9CA3AF).
   - Light fills for cards/cells: very pale blue (#EFF6FF), pale gray (#F9FAFB), pale green (#F0FDF4), pale red (#FEF2F2).
   - Accent for highlights/errors: red (#DC2626) for errors, green (#16A34A) for correct, orange (#EA580C) for warnings.
   - Text: dark gray (#1F2937) for body, black (#111827) for headings.
5. Thin borders (1-2px), small rounded corners (4-8px). NO heavy shadows, NO thick outlines.
6. Use simple geometric symbols: ✓ and ✗ as plain text, not emoji badges or large circles.
7. Tables and structured layouts are PREFERRED over free-form illustrations.
8. Text is the PRIMARY content carrier — render all specified text clearly and completely.
   Use adequate font size for readability at print scale.
9. Generous whitespace, clear visual hierarchy through font size and weight (not color intensity).
10. Overall feel: like a Figure in a Nature/Science paper or NSFC proposal —
    structured, informative, understated elegance. NOT a marketing infographic.
11. All text in the language specified by the user. Keep prompt under 350 words.
12. CRITICAL: Hex color codes (like #16A34A) are STYLE DIRECTIVES for the renderer only.
    They must NEVER appear as visible text in the image. When describing text content
    to be displayed, write ONLY the actual text. Describe colors separately as style
    instructions (e.g., "the word '是' rendered in green" NOT "'是 (#16A34A)'")."""

FIGURE_TYPES = {
    "comparison": {
        "label": "方法对比图",
        "extra": """
You specialize in clean academic METHOD COMPARISON diagrams.
- Two-column table or card layout: LEFT = baseline/existing method, RIGHT = proposed method.
- Each column has a thin-bordered card with a simple colored header bar (left: pale red/gray, right: pale blue/green).
- Use plain ✓ (green text) and ✗ (red text) symbols — NOT large emoji badges.
- Rows inside each card use alternating very pale fills for readability.
- If there's shared input, place it in a simple top row/card with thin blue border.
- Differences are shown via structured rows (like a table), with clear text labels.
- A thin vertical line or simple "vs" text divides the two columns.
- Bottom section: clean arrow-connected boxes for any flow/mechanism.""",
        "style": "clean academic comparison table, white background, thin borders, structured rows",
    },
    "framework": {
        "label": "研究框架 / 技术路线图",
        "extra": """
You specialize in visually rich RESEARCH FRAMEWORK diagrams.
- Flowing top-down or left-right layout with 3-5 major phases.
- Each phase is a large rounded card with: colored gradient header bar, icon, short title, 2-3 bullet keywords.
- Different color themes per phase (blue → teal → purple → coral progression).
- Thick gradient arrows connecting phases, with small labels on arrows.
- The core innovation phase should have a glowing accent border or star badge.
- Include a subtle timeline or phase numbering along the side.
- Add small relevant icons inside each card (database, model, evaluation icons etc.).""",
        "style": "polished research roadmap, gradient cards, phase icons, colored flow arrows, academic infographic",
    },
    "architecture": {
        "label": "模型架构图",
        "extra": """
You specialize in visually polished MODEL ARCHITECTURE diagrams.
- Stacked or connected blocks with gradient fills (blue, purple, teal for different layers).
- Each block has: colored fill, thin border, short label, and a small icon representing function.
- Soft drop shadows on each block for depth.
- Data flow shown with thick colored arrows (matching source block color).
- Dimension annotations in small rounded badges beside blocks.
- Input/output shown as elegant pill-shaped elements at top and bottom.
- Use visual grouping: dashed rounded rectangles to group related components (e.g., "Encoder", "Decoder").""",
        "style": "polished neural network diagram, gradient blocks, colored flow arrows, grouped layers, academic",
    },
    "concept": {
        "label": "概念示意图",
        "extra": """
You specialize in visually engaging CONCEPTUAL ILLUSTRATIONS.
- Use visual metaphors and icons as the PRIMARY communication method, not text.
- Professional illustrated style: clean vector-like icons, soft gradients, subtle shadows.
- Before/after or problem/solution shown as two visual scenes with clear contrast.
- Problem side: muted colors, broken/disconnected visual elements.
- Solution side: vibrant colors, connected/flowing visual elements.
- A central transformative arrow or bridge between the two sides.
- Minimal text: only short labels and one-line annotations.""",
        "style": "visual concept illustration, icon-driven, dual-scene, professional infographic, academic",
    },
    "pipeline": {
        "label": "数据流程 / Pipeline 图",
        "extra": """
You specialize in clean academic DATA PIPELINE / WORKFLOW diagrams.
- Horizontal left-to-right or top-to-bottom flow with clean rectangular stages.
- Each stage: white/pale fill card with thin colored border (1-2px), short label inside.
- Thin gray or blue arrows connecting stages, with small step labels above arrows.
- Use subtle color differentiation: pale blue for input, pale gray for processing, pale green for output.
- Tables are welcome when the content is structured data.
- Code/JSON blocks should use monospace font in a light gray bordered box.
- Keep all text clearly readable at print scale.""",
        "style": "clean academic workflow, thin borders, structured layout, white background",
    },
    "scenario": {
        "label": "应用场景图",
        "extra": """
You specialize in visually appealing APPLICATION SCENARIO illustrations.
- Clean isometric or 2.5D illustrated style with soft colors and subtle shadows.
- Real-world elements (people, devices, buildings) drawn as clean vector illustrations.
- Technology components shown as glowing/highlighted central elements.
- Data flows visualized as animated-looking dashed lines or particle trails.
- Each element has a small floating label badge.
- Use warm and cool color zones to separate user-side from system-side.
- Overall feel: professional tech illustration, like a high-end product whitepaper figure.""",
        "style": "isometric tech illustration, vector people and devices, glowing data flows, professional academic",
    },
}

# ── 内置预设描述 ──────────────────────────────────────────────────────────────

PRESETS = {
    "sdp_comparison": {
        "desc": """\
SDP增强摘要 vs 传统LLM摘要 效果对比图（以量子通信新闻为例）。

整体布局：上中下三段式，高度充足，文字排版宽松易读。

【顶部】— 原文卡片（占画面约25%）:
浅灰蓝圆角卡片，左侧蓝色文档图标📄，标题标签"原文"。
卡片内渲染以下完整中文原文（字号适中，行距1.6，确保每个字清晰可读）：
"中国科学院团队利用量子纠缠技术实现了1200公里的量子密钥分发实验。由于该实验突破了光纤传输的距离限制，使得基于卫星中继的全球量子通信网络成为可能。该成果随后被Nature评为年度十大科学突破之一。"
其中"由于"、"使得"、"随后"三个词用橙色圆角高亮标签。

【中间】— 左右双区对比（占画面约50%）:

左区 (a) "传统LLM摘要" — 红灰色调圆角卡片，顶部红色横幅+断裂链条图标:
卡片内先显示摘要文本（灰色字体，字号略小于原文）：
"中国科学院实现了量子密钥分发实验，被评为年度科学突破。"
文本下方用红色删除线或灰色标注缺失内容。
再用3行图标+标签：
  ✗ 丢失关键数据"1200公里"
  ✗ 丢失因果链（距离突破→全球网络）
  ✗ 遗漏"量子纠缠""卫星中继"

中间竖向 "VS" 圆形徽章。

右区 (b) "SDP增强摘要" — 蓝绿色调圆角卡片，顶部蓝色渐变横幅+完整链条图标:
卡片内先显示摘要文本（深色字体，清晰）：
"中国科学院利用量子纠缠技术实现1200公里量子密钥分发，突破光纤距离限制，推动全球量子通信网络建设，入选Nature年度十大突破。"
再用3行图标+标签：
  ✓ 保留关键数据"1200公里"
  ✓ 因果事件链完整保留
  ✓ 核心技术细节完整

【底部】— SDP因果链可视化（占约25%）:
三个彩色圆角节点 + 粗渐变箭头形成事件链：
  [量子实验1200km] ──Cause(由于)──▶ [突破距离限制] ──Result(使得)──▶ [全球网络可行]
节点蓝、紫、绿色，箭头标签用橙色药丸标签。""",
        "type": "comparison",
        "lang": "zh",
        "ratio": "4:3",
        "size": "2K",
    },
    "sdp_mechanism": {
        "desc": """\
SDP（语义依存分析）从原文提取因果事件链并指导摘要生成的技术机制。
三层自上而下流程图，每层之间用粗渐变箭头连接。

【第一层】原文输入:
一个浅灰渐变圆角大卡片，左侧有文档图标。
内部只展示1行关键文本，"由于/使得/随后" 用橙色圆角标签高亮。

【第二层】SDP语义依存解析（核心区域，浅蓝渐变背景大框，占画面50%）:
标题 "SDP 语义依存解析" 放在蓝色横幅中。
四个彩色节点（大圆角矩形，每个有渐变填充和图标）：
  A [蓝色渐变] 量子实验 🔬  →  B [紫色渐变] 突破距离 🚀  →  C [绿色渐变] 全球网络 🌐
  另有 D [黄色渐变] Nature突破 ⭐ 从B分支出去
节点间用粗彩色曲线箭头连接，箭头上的标签 "Cause" "Result" "Temporal" 用小圆角标签。
旁边一个小注释框: "SDP识别: Agent · Event · Cause · Result"

【第三层】摘要生成输出:
左右两个小卡片：
  左 [灰色虚线框] "无SDP" + 断裂链图标
  右 [蓝色实线框] "SDP增强" + 完整链图标 + 发光效果
一条粗蓝色箭头从第二层指向右卡片，标注"事件链约束"。""",
        "type": "pipeline",
        "lang": "zh",
        "ratio": "4:3",
        "size": "2K",
    },
    "sdp_slot_filling": {
        "desc": """\
SDP语义角色引导的参数抽取对比图（以机票搜索指令为例）。
学术论文配图风格，白底，表格化布局，干净克制。

【顶部】— 用户指令:
白底薄边框卡片（1px灰色边框），左侧小字标签"输入指令"。
内容用标准深色字体显示完整指令：
"帮我搜索上海到东京下周五的机票，经济舱，2位成人"
关键词用彩色下划线标注（不是高亮背景，只是下划线）：
  "上海"蓝色下划线、"东京"紫色下划线、"下周五"橙色下划线、"经济舱"青色下划线、"2位成人"绿色下划线

【中间主体】— 对比表格，左右两列，中间用细竖线分隔:

表头行（浅灰底）：
  左列标题："(a) 无SDP（直接抽取）"
  右列标题："(b) 有SDP（语义角色引导）"

5行数据，每行左右对应，交替用白色和极浅灰底（#F9FAFB）：

第1行 departure:
  左: departure → "上海" ✓
  右: departure → "上海"（Source角色）✓

第2行 destination（关键差异行，左侧浅红底#FEF2F2）:
  左: destination → 缺失 ✗（红色字）
  右: destination → "东京"（Goal角色）✓

第3行 date:
  左: date → "下周五" ✓
  右: date → "下周五"（Time角色）✓

第4行 cabin_class:
  左: cabin_class → "经济舱" ✓
  右: cabin_class → "经济舱"（Manner角色）✓

第5行 passengers（关键差异行，左侧浅橙底#FFF7ED）:
  左: passengers → "2" ⚠ 类型错误（橙色字）
  右: passengers → {"adult": 2}（Quantity角色）✓

表格底部统计行：
  左: "2项错误"红色小字
  右: "5/5 正确"绿色小字

【底部】— 说明文字（普通段落样式，不要花哨横幅）:
一行简洁说明：
"SDP通过Source/Goal语义角色准确区分出发地与目的地，通过Quantity角色识别乘客信息的结构化类型。"
字体比表格正文略小，灰色。""",
        "type": "comparison",
        "lang": "zh",
        "ratio": "4:3",
        "size": "2K",
    },
    "sdp_role_mapping": {
        "desc": """\
SDP语义角色到工具参数的映射与填充流程图（以weather_api为例）。
学术论文配图风格，白底，表格+流程结合布局，干净克制。
整体自上而下三部分。

【第一部分】— 参数-角色映射表（占画面约40%）:
标题："weather_api 参数-语义角色映射表"，左对齐，深色粗体小号字。
一个标准4列表格，1px灰色边框，表头浅灰底(#F3F4F6)粗体：
  工具参数 | 期望语义角色 | 示例填充值 | 是否必需

4行数据，交替白色和极浅灰底(#F9FAFB)：
  location   | Location（地点）| "北京"        | 是
  time_range | Time（时间）    | "明天"        | 否（默认"今天"）
  metrics    | Content（内容） | "温度,降水"   | 否（默认全部）
  unit       | Manner（方式）  | "摄氏度"      | 否（默认摄氏）

"是"用绿色字，"否"用灰色字。语义角色名用蓝色等宽字体。

【第二部分】— SDP分析与映射过程（占画面约40%）:
左侧：用户指令卡片，1px蓝色细边框，标签"用户指令"。
内容："查询北京明天的温度和降水概率"
关键词用彩色下划线："北京"蓝色、"明天"橙色、"温度和降水概率"青色。

中间：一个竖向箭头标注"SDP语义角色分析"，箭头下方列出分析结果，
每行格式为 角色→填充值，用细线框小卡片：
  Location → "北京"
  Time → "明天"
  Content → "温度,降水概率"

右侧：工具调用结果卡片，1px绿色细边框，标签"weather_api调用"。
以代码/JSON样式展示填充结果：
  weather_api(
    location = "北京",      ← Location
    time_range = "明天",    ← Time
    metrics = "温度,降水概率", ← Content
    unit = "摄氏度"          ← 默认值
  )

左→中→右之间用细灰色水平箭头连接，箭头上标注步骤：
  "①SDP解析" 和 "②角色-参数映射"

【第三部分】— 底部一行说明（约10%）:
灰色小号字：
"SDP为每个工具参数标注期望语义角色，实现用户自然语言到结构化API调用的准确映射。"
""",
        "type": "pipeline",
        "lang": "zh",
        "ratio": "4:3",
        "size": "2K",
    },
    "sdp_exec_plan": {
        "desc": """\
SDP驱动的多步骤工具调用执行计划生成示意图。
学术论文配图风格，白底，流程图布局，干净克制。
整体自上而下三部分。

【第一部分】— 用户指令（约15%高度）:
1px灰色边框卡片，标签"用户指令"。
内容用标准深色字体完整显示：
"下载这个网页的内容，提取其中的表格，翻译成中文，并计算第一列的平均值"
四个动作动词用蓝色加粗标注：下载、提取、翻译、计算

【第二部分】— 执行计划流程图（约70%高度，核心区域）:
用标准流程图节点展示执行计划，自上而下布局。
每个步骤是一个白底、1px蓝色细边框的圆角矩形，内部显示工具调用。

Step 1 节点（顶部，居中）:
  web_scraper(url) → content
  节点左侧小灰色标签 "Step 1"

一条细灰色向下箭头，箭头旁标注数据流 "content"

Step 2 节点（中部，居中）:
  table_extractor(content) → table
  节点左侧小灰色标签 "Step 2"

从 Step 2 向下分出两条箭头（分叉），形成并行结构：
  左分支箭头和右分支箭头，两条箭头旁都标注 "table"
  分叉处用一个小的虚线框标注 "并行执行"

Step 3a 节点（左下）:
  translator(table) → 翻译结果
  节点左侧小灰色标签 "Step 3a"

Step 3b 节点（右下）:
  statistics(table, column=0) → 平均值
  节点左侧小灰色标签 "Step 3b"

Step 3a 和 Step 3b 在同一水平线上，表示并行。
两个节点之间用一条水平虚线连接，虚线中间标注 "parallel"。

关键视觉要素：
- 串行部分（Step1→Step2）用实线箭头
- 并行分叉处用虚线框圈住，标注"并行执行"
- 依赖关系通过箭头方向和数据标注体现

【第三部分】— 底部说明（约15%高度）:
灰色小号字两行：
"SDP分析指令中的动作依赖关系：翻译和计算都依赖于提取的结果但彼此独立，可并行执行。"
"该方法还支持条件分支规划（如"如果...则..."），生成带条件判断的执行计划。"
""",
        "type": "pipeline",
        "lang": "zh",
        "ratio": "4:3",
        "size": "2K",
    },
}

# ── 核心函数 ──────────────────────────────────────────────────────────────────

def _call_claude(system: str, user_msg: str, temperature: float = 0.6) -> str:
    """调用 Bedrock Claude 并返回文本响应。"""
    import boto3

    client = boto3.client("bedrock-runtime", region_name=AWS_REGION)
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1024,
        "system": system,
        "messages": [{"role": "user", "content": user_msg}],
        "temperature": temperature,
    })
    resp = client.invoke_model(
        modelId=CLAUDE_MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=body,
    )
    result = json.loads(resp["body"].read())
    return result["content"][0]["text"].strip()


def optimize_prompt(
    description: str,
    figure_type: str = "comparison",
    language: str = "zh",
    aspect_ratio: str = "4:3",
) -> str:
    """用 Claude 将粗略描述优化为高质量图片生成 prompt。"""
    cfg = FIGURE_TYPES[figure_type]
    system = ACADEMIC_BASE + cfg["extra"]
    user_msg = (
        f"Create an image generation prompt for this research figure:\n\n"
        f"Description: {description}\n"
        f"Figure type: {cfg['label']}\n"
        f"Style: {cfg['style']}\n"
        f"Text label language: {language}\n"
        f"Aspect ratio: {aspect_ratio}\n\n"
        f"Generate the optimized prompt:"
    )
    return _call_claude(system, user_msg)


def generate_image(
    prompt: str,
    aspect_ratio: str = "4:3",
    image_size: str = "2K",
    timeout: int = 180,
) -> bytes:
    """
    调用 Yunwu API 生成图片，返回图片 bytes。

    Args:
        prompt:       图片生成 prompt
        aspect_ratio: 宽高比，如 "4:3", "16:9", "1:1"
        image_size:   分辨率档位 "1K" / "2K" / "4K"
        timeout:      超时秒数（2K/4K 生成较慢，默认 180s）
    """
    if not YUNWU_API_KEY:
        print("[ERROR] YUNWU_API_KEY 未设置", file=sys.stderr)
        sys.exit(1)

    if image_size not in ("1K", "2K", "4K"):
        print(f"[WARN] image_size='{image_size}' 不在 1K/2K/4K 中，回退到 2K")
        image_size = "2K"

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["IMAGE", "TEXT"],
            "imageConfig": {
                "aspectRatio": aspect_ratio,
                "imageSize": image_size,
            },
        },
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        YUNWU_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {YUNWU_API_KEY}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        result = json.loads(resp.read())

    candidates = result.get("candidates", [])
    if not candidates:
        raise RuntimeError(f"Yunwu 无返回: {json.dumps(result, ensure_ascii=False)[:300]}")

    for part in candidates[0].get("content", {}).get("parts", []):
        if "inlineData" in part:
            return base64.b64decode(part["inlineData"]["data"])

    raise RuntimeError("Yunwu 响应中未找到图片数据")


def save(image_data: bytes, path: Path) -> None:
    """保存图片并打印尺寸信息。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(BytesIO(image_data))
    img.save(str(path))
    print(f"  -> Saved: {path}  ({img.size[0]}x{img.size[1]})")


# ── 主流程 ────────────────────────────────────────────────────────────────────

def run(
    description: str,
    figure_type: str = "comparison",
    language: str = "zh",
    aspect_ratio: str = "4:3",
    image_size: str = "2K",
    output_path: str | None = None,
    prompt_only: bool = False,
) -> dict:
    """
    完整流程: Claude 优化 prompt → Yunwu 生成图片 → 保存。

    返回 dict: optimized_prompt, image_path (如果生成了图片)
    """
    # 校验类型
    if figure_type not in FIGURE_TYPES:
        avail = ", ".join(FIGURE_TYPES)
        print(f"[ERROR] 未知类型 '{figure_type}'，可选: {avail}", file=sys.stderr)
        sys.exit(1)

    label = FIGURE_TYPES[figure_type]["label"]

    # Step 1: 优化 prompt
    print(f"\n[1/2] 优化 Prompt ({label})...")
    optimized = optimize_prompt(description, figure_type, language, aspect_ratio)

    print(f"\n{'─'*60}")
    print("优化后的 Prompt:")
    print(f"{'─'*60}")
    print(optimized)
    print(f"{'─'*60}\n")

    result = {"optimized_prompt": optimized}

    if prompt_only:
        print("[Done] 仅输出 prompt，未生成图片。")
        return result

    # Step 2: 生成图片
    print(f"[2/2] 调用 Yunwu API 生成图片 (分辨率: {image_size})...")
    image_data = generate_image(optimized, aspect_ratio, image_size)

    # 确定输出路径
    if output_path:
        out = Path(output_path)
    else:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        out = OUTPUT_DIR / f"{figure_type}_{ts}.png"

    save(image_data, out)
    result["image_path"] = str(out)

    print("\n[Done] 生成完成！")
    return result


# ── 交互模式 ──────────────────────────────────────────────────────────────────

def interactive():
    """无参数时进入交互模式。"""
    print("\n" + "=" * 60)
    print("  科研申请书配图生成器")
    print("  Claude 4.5 Sonnet → Yunwu (Gemini 3 Pro Image)")
    print("=" * 60)

    # 选择类型
    print("\n可用插图类型:")
    keys = list(FIGURE_TYPES)
    for i, k in enumerate(keys):
        print(f"  [{i}] {k:15s}  {FIGURE_TYPES[k]['label']}")
    print(f"\n内置预设:")
    preset_keys = list(PRESETS)
    for i, k in enumerate(preset_keys):
        print(f"  [p{i}] {k}")

    choice = input("\n选择类型编号 / 预设编号 / 直接回车默认 comparison: ").strip()

    # 预设
    if choice.startswith("p") and choice[1:].isdigit():
        idx = int(choice[1:])
        if 0 <= idx < len(preset_keys):
            preset = PRESETS[preset_keys[idx]]
            print(f"\n使用预设: {preset_keys[idx]}")
            return run(
                description=preset["desc"],
                figure_type=preset["type"],
                language=preset["lang"],
                aspect_ratio=preset["ratio"],
                image_size=preset.get("size", "2K"),
            )

    # 类型选择
    if choice.isdigit() and 0 <= int(choice) < len(keys):
        fig_type = keys[int(choice)]
    elif choice in FIGURE_TYPES:
        fig_type = choice
    else:
        fig_type = "comparison"

    print(f"\n已选类型: {fig_type} ({FIGURE_TYPES[fig_type]['label']})")

    # 输入描述
    print("\n请输入图片描述 (输入空行结束，支持多行):")
    lines = []
    while True:
        line = input()
        if line == "":
            if lines:
                break
            continue
        lines.append(line)
    desc = "\n".join(lines)

    # 语言
    lang = input("\n图中标注语言 [zh/en, 默认 zh]: ").strip() or "zh"
    ratio = input("宽高比 [4:3/16:9/1:1, 默认 4:3]: ").strip() or "4:3"
    size = input("分辨率 [1K/2K/4K, 默认 2K]: ").strip() or "2K"

    return run(desc, fig_type, lang, ratio, size)


# ── CLI 入口 ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="科研申请书配图生成 (Claude + Yunwu)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
示例:
  %(prog)s --preset sdp_comparison
  %(prog)s --preset sdp_mechanism
  %(prog)s --desc "模型架构：Encoder-Decoder with attention" --type architecture
  %(prog)s --desc "..." --type comparison --lang zh --ratio 4:3
  %(prog)s --desc "..." --prompt-only
""",
    )
    parser.add_argument("--desc", type=str, help="图片描述 (中英文均可)")
    parser.add_argument(
        "--type",
        type=str,
        default="comparison",
        choices=list(FIGURE_TYPES),
        help="插图类型 (default: comparison)",
    )
    parser.add_argument("--lang", type=str, default="zh", help="标注语言 zh/en (default: zh)")
    parser.add_argument("--ratio", type=str, default="4:3", help="宽高比 (default: 4:3)")
    parser.add_argument("--size", type=str, default="2K", choices=["1K", "2K", "4K"], help="分辨率 1K/2K/4K (default: 2K)")
    parser.add_argument("--output", "-o", type=str, help="输出文件路径")
    parser.add_argument("--preset", type=str, choices=list(PRESETS), help="使用内置预设")
    parser.add_argument("--prompt-only", action="store_true", help="仅输出优化后的 prompt，不生成图片")
    parser.add_argument("--list-types", action="store_true", help="列出所有可用类型")
    parser.add_argument("--list-presets", action="store_true", help="列出所有内置预设")

    args = parser.parse_args()

    # 列出类型
    if args.list_types:
        for k, v in FIGURE_TYPES.items():
            print(f"  {k:15s}  {v['label']}")
        return

    # 列出预设
    if args.list_presets:
        for k, v in PRESETS.items():
            print(f"\n  [{k}]  type={v['type']}  lang={v['lang']}  ratio={v['ratio']}")
            print(f"  {v['desc'][:100]}...")
        return

    # 使用预设
    if args.preset:
        p = PRESETS[args.preset]
        run(
            description=p["desc"],
            figure_type=p["type"],
            language=p["lang"],
            aspect_ratio=p["ratio"],
            image_size=args.size if args.size != "2K" else p.get("size", "2K"),
            output_path=args.output,
            prompt_only=args.prompt_only,
        )
        return

    # 命令行传参
    if args.desc:
        run(
            description=args.desc,
            figure_type=args.type,
            language=args.lang,
            aspect_ratio=args.ratio,
            image_size=args.size,
            output_path=args.output,
            prompt_only=args.prompt_only,
        )
        return

    # 无参数 → 交互模式
    interactive()


if __name__ == "__main__":
    main()

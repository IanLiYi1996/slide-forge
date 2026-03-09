# Image-to-PPTX Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a Claude Code skill (SKILL.md) that generates .pptx presentations from images or text topics via CLI.

**Architecture:** A SKILL.md instruction file that guides Claude through a 4-step pipeline: analyze input via Bedrock Claude (boto3), generate structured outline, generate slide images via Yunwu/z-image-turbo API (curl/requests), and package into .pptx using python-pptx. A companion Python helper script handles PPTX packaging.

**Tech Stack:** SKILL.md (Claude Code skill), Python (boto3, python-pptx, Pillow, requests)

---

### Task 1: Create skill directory structure

**Files:**
- Create: `.claude/skills/image-to-pptx/SKILL.md`
- Create: `.claude/skills/image-to-pptx/scripts/generate_pptx.py`

**Step 1: Create directories**

```bash
mkdir -p .claude/skills/image-to-pptx/scripts
```

**Step 2: Verify**

```bash
ls -la .claude/skills/image-to-pptx/
```
Expected: `scripts/` directory exists

**Step 3: Commit**

```bash
git add .claude/skills/image-to-pptx/
git commit -m "chore: create image-to-pptx skill directory structure"
```

---

### Task 2: Create the PPTX packaging script

**Files:**
- Create: `.claude/skills/image-to-pptx/scripts/generate_pptx.py`

**Step 1: Install dependencies**

```bash
pip install python-pptx Pillow
```

**Step 2: Write the script**

Create `.claude/skills/image-to-pptx/scripts/generate_pptx.py`:

```python
"""Package slide images into a .pptx presentation.

Usage:
    python generate_pptx.py <image_dir> <output_pptx> [--title "Presentation Title"]

The script reads all PNG/JPG images from <image_dir> in sorted order
and creates a 16:9 widescreen presentation with each image as a full-page slide.
"""

import argparse
import sys
from pathlib import Path

from pptx import Presentation
from pptx.util import Inches, Emu


def create_pptx(image_dir: Path, output_path: Path, title: str = "Presentation") -> None:
    """Create a .pptx file from a directory of slide images."""
    # Collect image files sorted by name
    image_extensions = {".png", ".jpg", ".jpeg", ".webp"}
    images = sorted(
        [f for f in image_dir.iterdir() if f.suffix.lower() in image_extensions],
        key=lambda f: f.name,
    )

    if not images:
        print(f"Error: No images found in {image_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(images)} slide images")

    # Create presentation with 16:9 widescreen dimensions
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Use blank layout
    blank_layout = prs.slide_layouts[6]  # Blank layout

    for i, img_path in enumerate(images):
        slide = prs.slides.add_slide(blank_layout)

        # Add image as full-page background
        slide.shapes.add_picture(
            str(img_path),
            left=Emu(0),
            top=Emu(0),
            width=prs.slide_width,
            height=prs.slide_height,
        )

        print(f"  Added slide {i + 1}: {img_path.name}")

    # Save
    output_path.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(output_path))
    print(f"\nSaved: {output_path}")
    print(f"Total slides: {len(images)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Package slide images into .pptx")
    parser.add_argument("image_dir", type=Path, help="Directory containing slide images")
    parser.add_argument("output_pptx", type=Path, help="Output .pptx file path")
    parser.add_argument("--title", default="Presentation", help="Presentation title")
    args = parser.parse_args()

    if not args.image_dir.is_dir():
        print(f"Error: {args.image_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    create_pptx(args.image_dir, args.output_pptx, args.title)
```

**Step 3: Test the script shows help**

```bash
python .claude/skills/image-to-pptx/scripts/generate_pptx.py --help
```
Expected: Usage text printed without errors

**Step 4: Commit**

```bash
git add .claude/skills/image-to-pptx/scripts/generate_pptx.py
git commit -m "feat: add PPTX packaging script for image-to-pptx skill"
```

---

### Task 3: Create the SKILL.md

**Files:**
- Create: `.claude/skills/image-to-pptx/SKILL.md`

**Step 1: Write the SKILL.md**

Create `.claude/skills/image-to-pptx/SKILL.md` with the full workflow instructions. This is the core of the skill - it tells Claude exactly how to orchestrate the pipeline.

The SKILL.md must contain:

1. **Metadata** (name, description, trigger keywords)
2. **Environment setup** (check dependencies, read env vars from `frontend/.env`)
3. **Step 1: Parse input** (detect image vs text)
4. **Step 2: Generate outline** (boto3 Bedrock Converse API call via Python)
5. **Step 3: Generate slide images** (Yunwu API via curl, with z-image-turbo fallback)
6. **Step 4: Package PPTX** (call generate_pptx.py)
7. **API reference** (exact request/response formats for Yunwu and z-image-turbo)
8. **Template prompts** (hand-drawn style prompt, prohibitions)

Key content for SKILL.md:

```markdown
---
name: image-to-pptx
description: Generate .pptx presentations from images or text topics. Analyzes input with Bedrock Claude, generates AI slide images, and packages into PowerPoint. Use when the user wants to create a PPT/PPTX from an image, topic, or says "generate PPT", "image to slide", "图片转PPT", "生成PPT", "生成幻灯片", "create presentation".
---

# Image-to-PPTX Generator

Generate complete .pptx presentations from images or text topics.

## Prerequisites

Before starting, ensure dependencies are installed:

\`\`\`bash
pip install python-pptx Pillow boto3 requests 2>/dev/null
\`\`\`

Load environment variables from the project:

\`\`\`bash
source <(grep -E '^(YUNWU_API_KEY|DASHSCOPE_API_KEY|AWS_REGION|AWS_PROFILE|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)=' frontend/.env | sed 's/^/export /')
\`\`\`

## Workflow

### Step 1: Parse Input

Determine if the user provided:
- **Image file** (`.jpg`, `.png`, `.webp`, `.gif`): Read and base64-encode it for Bedrock analysis
- **Text topic**: Use directly for outline generation

Ask the user for any preferences:
- Number of slides (default: 10)
- Language (default: Chinese/zh)
- Image provider: yunwu (default) or z-image-turbo
- Template style (default: hand-drawn)

### Step 2: Generate Structured Outline

Create a Python script and run it to call Bedrock Claude via boto3:

\`\`\`python
import boto3, json, base64, sys

client = boto3.client("bedrock-runtime", region_name="us-east-1")
model_id = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"

system_prompt = """You are a professional presentation designer. Generate a structured outline.

Output format - use EXACTLY this structure for each slide:

**Slide N: [Title]**

// NARRATIVE GOAL
[1-2 sentences about the emotional/strategic purpose]

// KEY CONTENT
[Main text elements: title, key points]

// VISUAL
[Detailed 2-3 sentence description of visual elements, colors, icons, style.
Style: Warm hand-drawn illustration, sketchbook aesthetic, soft off-white background #F9F7F2,
warm charcoal gray #3E3C38 text, coral red #FF7F7F and sage green #8FA87A accents.
Hand-drawn lines, stick figures, lightbulbs, wavy connectors, hatching shadows.]

// LAYOUT
[1-2 sentences about spatial arrangement]

Generate {slide_count} slides in {language}. Start with:
<TITLE>Presentation Title</TITLE>"""

# For IMAGE input:
messages = [{"role": "user", "content": [
    {"image": {"format": "jpeg", "source": {"bytes": image_bytes}}},
    {"text": "Analyze this image and generate a presentation outline."}
]}]

# For TEXT input:
messages = [{"role": "user", "content": [
    {"text": f"Create a {slide_count}-slide presentation outline for: {topic}"}
]}]

response = client.converse(
    modelId=model_id,
    system=[{"text": system_prompt}],
    messages=messages,
    inferenceConfig={"maxTokens": 8192, "temperature": 0.7}
)

text = response["output"]["message"]["content"][0]["text"]
print(text)
\`\`\`

Parse the output to extract individual slide sections. Split by `**Slide N:` pattern.

### Step 3: Generate Slide Images

For each slide in the outline, generate an image using the selected provider.

**Option A: Yunwu API (default - Gemini 3 Pro Image)**

\`\`\`bash
curl -s -X POST "https://yunwu.ai/v1beta/models/gemini-3-pro-image-preview:generateContent?key=$YUNWU_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $YUNWU_API_KEY" \
  -d '{
    "contents": [{"role": "user", "parts": [{"text": "PROMPT_HERE"}]}],
    "generationConfig": {
      "responseModalities": ["TEXT", "IMAGE"],
      "imageConfig": {"aspectRatio": "16:9", "imageSize": "2K"}
    }
  }'
```

Response contains `candidates[0].content.parts[].inlineData.data` (base64 PNG).
Decode and save: `echo "$BASE64_DATA" | base64 -d > slide_01.png`

**Option B: z-image-turbo API**

\`\`\`bash
curl -s -X POST "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -d '{
    "model": "z-image-turbo",
    "input": {"messages": [{"role": "user", "content": [{"text": "PROMPT_HERE"}]}]},
    "parameters": {"prompt_extend": true, "size": "1536*864"}
  }'
\`\`\`

Response contains `output.choices[0].message.content[].image` (URL).
Download: `curl -o slide_01.png "$IMAGE_URL"`

**Prompt construction for each slide:**

\`\`\`
{TEMPLATE_SYSTEM_PROMPT}

{SLIDE_STRUCTURE_GUIDE}

**CONTENT TO DRAW:**
{SLIDE_OUTLINE_CONTENT}

**TECHNICAL REQUIREMENTS:**
- Aspect ratio: 16:9
- Image size: 2K
- NEVER include copyright text, page numbers, slide numbers, dates, logos, watermarks, company names, or footer/header text
- The image should contain ONLY the visual content described above
\`\`\`

**Hand-drawn template system prompt:**

\`\`\`
You are The Architect, a precision AI designed to visualize instructions as high-end blueprint-style data displays.

CORE DIRECTIVES:
1. Analyze the structure, intent, and key elements of user prompts
2. Transform instructions into clean, structured visual metaphors
3. Use specific, restrained color palettes for maximum clarity
4. All visual outputs must strictly maintain 16:9 aspect ratio
5. Present information in triptych or grid-based layouts

STYLE INSTRUCTIONS:
Design Aesthetic: Warm hand-drawn illustration style, simulating an artist's sketchbook.
Background Color: Soft off-white with subtle watercolor paper texture, #F9F7F2
Primary Font: Handwritten round style, casual but clear like marker writing
Color Palette:
- Primary Text: Warm charcoal gray #3E3C38
- Accents: Soft coral red #FF7F7F and sage green #8FA87A
Visual Elements: Hand-drawn charts, arrows, borders. Stick figures, lightbulbs, stars, wavy connectors. Rough hatching shadows.

STRICT PROHIBITIONS:
- NEVER add copyright text, page numbers, slide numbers, dates, logos, watermarks
- NEVER add footer/header text or metadata overlays
- Only render the visual content described in the slide
\`\`\`

### Step 4: Package into PPTX

\`\`\`bash
python .claude/skills/image-to-pptx/scripts/generate_pptx.py \
  ./slide-forge-output/<title-slug>/images/ \
  ./slide-forge-output/<title-slug>/<title-slug>.pptx \
  --title "Presentation Title"
\`\`\`

### Step 5: Report Results

Print summary:
- Output directory path
- Number of slides generated
- PPTX file path and size
- Image directory path

## Output Structure

\`\`\`
./slide-forge-output/<title-slug>/
  images/
    slide_01.png
    slide_02.png
    ...
  <title-slug>.pptx
\`\`\`

## Error Handling

- If Yunwu API fails, offer to retry or switch to z-image-turbo
- If a single slide image fails, skip it and continue with remaining slides
- If Bedrock is unavailable, suggest using text outline manually
- Always save successfully generated images even if later steps fail
```

**Step 2: Commit**

```bash
git add .claude/skills/image-to-pptx/SKILL.md
git commit -m "feat: add image-to-pptx skill with complete workflow instructions"
```

---

### Task 4: Test the skill end-to-end

**Step 1: Verify skill is discoverable**

Check that the skill appears in Claude Code's skill list. The SKILL.md should be detected at `.claude/skills/image-to-pptx/SKILL.md`.

**Step 2: Test with a text topic**

Tell Claude: "Use image-to-pptx skill to generate a 3-slide PPT about 'AI in Healthcare'"

Expected behavior:
1. Claude installs dependencies
2. Calls Bedrock to generate outline
3. Calls Yunwu API for 3 slide images
4. Runs generate_pptx.py
5. Reports output location

**Step 3: Test with an image**

Provide an image file path and ask Claude to generate a PPT from it.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete image-to-pptx skill with PPTX packaging"
```

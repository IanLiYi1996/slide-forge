---
name: image-to-pptx
description: Generate .pptx presentations from images or text topics. Analyzes input with Bedrock Claude, generates AI slide images, and packages into PowerPoint. Use when the user wants to create a PPT/PPTX from an image, topic, or says "generate PPT", "image to slide", "image to pptx", "create presentation from image", "create slides", "图片转PPT", "生成PPT", "生成幻灯片".
---

# Image-to-PPTX Generator

Generate complete .pptx presentations from images or text topics.

## Prerequisites

Before starting, ensure the venv exists and dependencies are installed:

```bash
SKILL_DIR=".claude/skills/image-to-pptx"
if [ ! -d "$SKILL_DIR/.venv" ]; then
  python3 -m venv "$SKILL_DIR/.venv"
  "$SKILL_DIR/.venv/bin/pip" install python-pptx Pillow boto3 requests -q
fi
PYTHON="$SKILL_DIR/.venv/bin/python"
```

Load environment variables from the project:

```bash
source <(grep -E '^(YUNWU_API_KEY|DASHSCOPE_API_KEY|AWS_REGION|AWS_PROFILE|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)=' frontend/.env | sed 's/^/export /' | sed 's/"//g')
```

## Workflow

### Step 1: Parse Input

Determine if the user provided:
- **Image file** (`.jpg`, `.png`, `.webp`, `.gif`): Will be base64-encoded for Bedrock analysis
- **Text topic**: Will be used directly for outline generation

Ask the user for preferences (or use defaults):
- Number of slides (default: 10)
- Language (default: Chinese/zh)
- Image provider: `yunwu` (default) or `z-image-turbo`
- Template style (default: hand-drawn)

Create the output directory:

```bash
TITLE_SLUG="<slugified-title>"  # e.g., "ai-in-healthcare"
OUTPUT_DIR="./slide-forge-output/$TITLE_SLUG"
mkdir -p "$OUTPUT_DIR/images"
```

### Step 2: Generate Structured Outline

Write and run a Python script to call Bedrock Claude via boto3.

**For IMAGE input:**

```python
import boto3, json, base64, sys
from pathlib import Path

client = boto3.client("bedrock-runtime", region_name="us-east-1")
model_id = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"

# Read and encode image
img_path = sys.argv[1]
slide_count = int(sys.argv[2]) if len(sys.argv) > 2 else 10
language = sys.argv[3] if len(sys.argv) > 3 else "Chinese"

img_bytes = Path(img_path).read_bytes()
suffix = Path(img_path).suffix.lower().lstrip(".")
fmt = "jpeg" if suffix in ("jpg", "jpeg") else suffix

system_prompt = f"""You are a professional presentation designer. Analyze the provided image and generate a structured outline.

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

response = client.converse(
    modelId=model_id,
    system=[{"text": system_prompt}],
    messages=[{"role": "user", "content": [
        {"image": {"format": fmt, "source": {"bytes": img_bytes}}},
        {"text": "Analyze this image and generate a presentation outline."}
    ]}],
    inferenceConfig={"maxTokens": 8192, "temperature": 0.7}
)

text = response["output"]["message"]["content"][0]["text"]
print(text)
```

**For TEXT input:**

```python
import boto3, json, sys

client = boto3.client("bedrock-runtime", region_name="us-east-1")
model_id = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"

topic = sys.argv[1]
slide_count = int(sys.argv[2]) if len(sys.argv) > 2 else 10
language = sys.argv[3] if len(sys.argv) > 3 else "Chinese"

system_prompt = f"""You are a professional presentation designer. Generate a structured outline.

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

response = client.converse(
    modelId=model_id,
    system=[{"text": system_prompt}],
    messages=[{"role": "user", "content": [
        {"text": f"Create a {slide_count}-slide presentation outline for: {topic}"}
    ]}],
    inferenceConfig={"maxTokens": 8192, "temperature": 0.7}
)

text = response["output"]["message"]["content"][0]["text"]
print(text)
```

Save the outline output to `$OUTPUT_DIR/outline.md`.

Parse the output: split by `**Slide ` pattern to extract individual slide sections.

### Step 3: Generate Slide Images

For each slide in the outline, construct a prompt and call the image generation API.

**Prompt construction for each slide:**

```
TEMPLATE_SYSTEM_PROMPT + SLIDE_CONTENT + TECHNICAL_REQUIREMENTS
```

Where TEMPLATE_SYSTEM_PROMPT is:

```
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
```

And TECHNICAL_REQUIREMENTS is:

```
**TECHNICAL REQUIREMENTS:**
- Aspect ratio: 16:9
- Image size: 2K
- NEVER include copyright text, page numbers, slide numbers, dates, logos, watermarks, company names, or footer/header text
- The image should contain ONLY the visual content described above, with no metadata or decorative text overlays
```

**Option A: Yunwu API (default - Gemini 3 Pro Image)**

Write a Python script to call the API and save images. Use Python (not curl) for reliable base64 handling:

```python
import requests, base64, json, sys, os, time

api_key = os.environ["YUNWU_API_KEY"]
url = f"https://yunwu.ai/v1beta/models/gemini-3-pro-image-preview:generateContent?key={api_key}"

prompt = sys.argv[1]  # Full prompt text
output_path = sys.argv[2]  # e.g., ./slide-forge-output/title/images/slide_01.png

response = requests.post(url, headers={
    "Content-Type": "application/json",
    "Authorization": f"Bearer {api_key}",
}, json={
    "contents": [{"role": "user", "parts": [{"text": prompt}]}],
    "generationConfig": {
        "responseModalities": ["TEXT", "IMAGE"],
        "imageConfig": {"aspectRatio": "16:9", "imageSize": "2K"}
    }
})

if response.status_code != 200:
    print(f"Error: {response.status_code} {response.text}", file=sys.stderr)
    sys.exit(1)

data = response.json()
for candidate in data.get("candidates", []):
    for part in candidate.get("content", {}).get("parts", []):
        if "inlineData" in part:
            img_data = base64.b64decode(part["inlineData"]["data"])
            with open(output_path, "wb") as f:
                f.write(img_data)
            print(f"Saved: {output_path} ({len(img_data)} bytes)")
            sys.exit(0)

print("Error: No image in response", file=sys.stderr)
sys.exit(1)
```

**Option B: z-image-turbo API**

```python
import requests, json, sys, os

api_key = os.environ["DASHSCOPE_API_KEY"]
url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"

prompt = sys.argv[1]
output_path = sys.argv[2]

response = requests.post(url, headers={
    "Content-Type": "application/json",
    "Authorization": f"Bearer {api_key}",
}, json={
    "model": "z-image-turbo",
    "input": {"messages": [{"role": "user", "content": [{"text": prompt}]}]},
    "parameters": {"prompt_extend": True, "size": "1536*864"}
})

if response.status_code != 200:
    print(f"Error: {response.status_code} {response.text}", file=sys.stderr)
    sys.exit(1)

data = response.json()
image_url = None
for choice in data.get("output", {}).get("choices", []):
    for content in choice.get("message", {}).get("content", []):
        if "image" in content:
            image_url = content["image"]
            break

if not image_url:
    print("Error: No image URL in response", file=sys.stderr)
    sys.exit(1)

img_response = requests.get(image_url)
with open(output_path, "wb") as f:
    f.write(img_response.content)
print(f"Saved: {output_path} ({len(img_response.content)} bytes)")
```

**Execution pattern:** For each slide (1 to N), write a temp script and run:

```bash
$PYTHON /tmp/generate_image.py "$FULL_PROMPT" "$OUTPUT_DIR/images/slide_$(printf '%02d' $i).png"
```

Add a 2-second delay between API calls to avoid rate limiting.

If a slide fails, log the error and continue with the next slide.

### Step 4: Package into PPTX

```bash
$PYTHON .claude/skills/image-to-pptx/scripts/generate_pptx.py \
  "$OUTPUT_DIR/images/" \
  "$OUTPUT_DIR/$TITLE_SLUG.pptx" \
  --title "$PRESENTATION_TITLE"
```

### Step 5: Report Results

Print a summary:

```
=== Presentation Generated ===
Title: <title>
Slides: <N> generated
Output: <path to .pptx>
Images: <path to images dir>
Size: <file size>
```

## Output Structure

```
./slide-forge-output/<title-slug>/
  outline.md          # Generated outline
  images/
    slide_01.png
    slide_02.png
    ...
  <title-slug>.pptx   # Final presentation
```

## Error Handling

- If Yunwu API fails for a slide, offer to retry or switch to z-image-turbo
- If a single slide image fails, skip it and continue with remaining slides
- If Bedrock is unavailable, ask the user to provide an outline manually
- Always save successfully generated images even if later steps fail
- If python-pptx is not installed, create the venv and install it automatically

## Alternative Templates

If the user requests a different style, replace the TEMPLATE_SYSTEM_PROMPT:

- **blueprint**: Technical, precise lines, grid-based, dark slate + blueprint blue
- **minimal**: Maximum white space, bold typography, monochromatic
- **corporate**: Navy + gray, formal layouts, business charts
- **creative**: Vibrant colors, asymmetric layouts, gradients

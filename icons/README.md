# ngLens Icon Requirements

## Required Icon Sizes

You need to create 3 icon files:

1. **icon16.png** - 16×16 pixels (toolbar icon)
2. **icon48.png** - 48×48 pixels (extensions page)
3. **icon128.png** - 128×128 pixels (Chrome Web Store)

## Design Guidelines

**Logo Concept:** Use the ◈ (diamond) symbol with "ngLens" branding

**Color Scheme (from dark theme):**
- Primary: #3794ff (DevTools blue)
- Background: #1e1e1e (dark)
- Text: #cccccc (light gray)

**Design Tips:**
- Keep it simple and recognizable
- Ensure it looks good at small sizes (16×16)
- Use PNG format with transparency
- High contrast for visibility

## Quick Creation Options

### Option 1: Using Figma (Free)
1. Go to figma.com
2. Create 128×128 artboard
3. Add ◈ symbol (or diamond shape)
4. Add "ng" text
5. Export as PNG at 16px, 48px, 128px

### Option 2: Using Canva (Free)
1. Go to canva.com
2. Create custom size: 128×128
3. Add diamond shape + text
4. Download as PNG
5. Resize to 16px, 48px using online tool

### Option 3: Using GIMP (Free, Desktop)
1. Download GIMP (gimp.org)
2. Create new image 128×128
3. Draw diamond + text
4. Export at different sizes

### Option 4: Using Online Generator
1. Go to icon-generator.net
2. Upload a simple design
3. Generate all sizes

## Temporary Placeholder

For testing, you can use a simple colored square:

```bash
# Create simple placeholder icons (macOS/Linux)
# 16x16 blue square
convert -size 16x16 xc:#3794ff ngLens/icons/icon16.png

# 48x48 blue square
convert -size 48x48 xc:#3794ff ngLens/icons/icon48.png

# 128x128 blue square  
convert -size 128x128 xc:#3794ff ngLens/icons/icon128.png
```

**Note:** Replace with proper designs before publishing!

## Recommended Final Design

```
┌─────────────┐
│   ╱╲        │  ← Diamond shape (◈)
│  ╱  ╲       │
│ ╱ ng ╲      │  ← "ng" in center
│ ╲    ╱      │
│  ╲  ╱       │
│   ╲╱        │
└─────────────┘
  Blue (#3794ff)
  on dark background
```

Save icons as:
- ngLens/icons/icon16.png
- ngLens/icons/icon48.png
- ngLens/icons/icon128.png

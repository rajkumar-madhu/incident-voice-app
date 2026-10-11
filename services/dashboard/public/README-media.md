# Landing media (`public/`)

| Asset | Purpose |
|-------|---------|
| `hero-poster.svg` | Hero fallback poster, OG image, reduced-motion static hero |
| `hero-loop.mp4` | Muted loop (~6s, H.264 ~200KB) — abstract waveform; generated via ffmpeg |
| `product-dashboard.svg` | Below-fold product frame (lazy-loaded) |

Regenerate `hero-loop.mp4` (Docker ffmpeg example):

```bash
docker run --rm -v "$PWD/public:/out" linuxserver/ffmpeg -y \
  -f lavfi -i "anoisesrc=d=6:c=pink:a=0.02" \
  -filter_complex "[0:a]aformat=channel_layouts=mono,showwaves=s=960x540:mode=line:rate=24:colors=#2b4cff|#ff5b2e[v]" \
  -map "[v]" -frames:v 144 -c:v libx264 -pix_fmt yuv420p -an /out/hero-loop.mp4
```

Keep total hero video under ~2MB for fast LCP on mobile.

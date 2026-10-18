# Demo clips

Each clip is a short, silent, looping MP4 recorded inside Maya (8 seconds or less, 960 px wide, under 2 MB).
To show a clip, put `<slug>.mp4` here and add it to `index.json`, for example:

    [{"slug":"ik-fk-snap","title":"IK / FK Snap","caption":"Snap a pose in one click"}]

The slug is the tool page name without `tool-` and `.html` (tool-ik-fk-snap.html -> ik-fk-snap).
Tool pages and the home page show a clip only when it is listed; an empty list shows nothing.

Compress a screen recording with FFmpeg:

    ffmpeg -i input.mov -an -vf "fps=15,scale=960:-2" -c:v libx264 -crf 28 -preset slow -movflags +faststart ik-fk-snap.mp4

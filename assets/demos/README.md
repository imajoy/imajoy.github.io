# Demo clips

Each clip is a short, silent, looping MP4 recorded inside Maya (8 seconds or less, 960 px wide, under 2 MB).
To show a clip, put `<slug>.mp4` here and add it to `index.json`, for example:

    [{"slug":"ik-fk-snap","title":"IK / FK Snap","caption":"Snap a pose in one click"}]

The slug is the tool page name without `tool-` and `.html` (tool-ik-fk-snap.html -> ik-fk-snap).
Tool pages and the home page show a clip only when it is listed; an empty list shows nothing.

Compress a screen recording with FFmpeg:

    ffmpeg -i input.mov -an -vf "fps=15,scale=960:-2" -c:v libx264 -crf 28 -preset slow -movflags +faststart ik-fk-snap.mp4

Record real Maya interactions with a scene you have permission to publish. Prioritise IK / FK Snap (mapping, validation, pose match), Rivet (selection, locator, parented object following deformation) and FBX Exporter (selection, export and actual output). Do not replace recordings with synthetic footage presented as the application. Keep sensitive project names, customer assets, license codes and personal information out of frame.

The homepage also has a separate illustrated workflow showcase. Those diagrams are labelled as illustrations and do not count as screen recordings. Real videos appear under “See them work” only after their files and manifest entries are added. The matching tool page shows its recording too.

Use a 16:9 frame such as 960×540; the player fits the full recording without cropping the Maya UI. Keep clips silent and make `caption` describe the visible operation/result. Loop playback starts only when the player is visible, stops offscreen or in a background tab, and respects system reduced-motion preferences. Under reduced motion, the player uses native controls instead of automatic playback. The player reserves its size and defers video downloading until it approaches view.

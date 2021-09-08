# Webcam streamer
This uses UV4L and WebRTC to stream a Raspberry Pi camera to the browser.

Source code originates from [PietroAvolio](https://github.com/PietroAvolio/uv4l-webrtc-raspberry-pi) and [Onixaz](https://github.com/Onixaz/uv4l-webrtc-front-end.git), only stripped down to the bare minimum.

Code by [https://www.linux-projects.org](https://www.linux-projects.org/)

## Install UV4L
Following the [official instructions](https://www.linux-projects.org/uv4l/installation/) in combination with [this guide](https://www.highvoltagecode.com/post/webrtc-on-raspberry-pi-live-hd-video-and-audio-streaming):

```
curl https://www.linux-projects.org/listing/uv4l_repo/lpkey.asc | sudo apt-key add -
```

```
echo "deb https://www.linux-projects.org/listing/uv4l_repo/raspbian/stretch stretch main" | sudo tee /etc/apt/sources.list.d/uv4l.list
```

```
sudo apt-get update && sudo apt-get upgrade
```

```
sudo apt-get install uv4l uv4l-webrtc
```

## Download the repo

```
git clone https://github.com/paranerd/webcam-streamer.git
```

```
cd webcam-streamer/
```

## Start the server
```
uv4l --external-driver --device-name=video0 \
--server-option '--enable-www-server=yes' \
--server-option '--www-root-path=/path/to/webcam-streamer' \
--server-option '–www-index-file=index.html' \
--server-option '--www-port=9000' \
--server-option '--www-webrtc-signaling-path=/stream/webrtc' \
--server-option '--enable-webrtc=yes' \
--server-option '--enable-webrtc-video=yes' \
--server-option '--enable-webrtc-audio=yes' \
--server-option '–-enable-webrtc-datachannels=yes'
```

Make sure to update the `/path/to/webcam-streamer`.

## Access the stream
In a Browser go to `http://raspberry-pi-ip:9000` and click `Pause/Resume`.

function httpGetAsync(theUrl, callback) {
    try {
        const xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function () {
            if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
                callback(xmlHttp.responseText);
            }
        };
        xmlHttp.open("GET", theUrl, true); // true for asynchronous
        xmlHttp.send(null);
    } catch (e) {
        console.error(e);
    }
}

const signalling_server_hostname = location.hostname || "192.168.1.8";
const signalling_server_address = signalling_server_hostname + ':' + (location.port || (location.protocol === 'https:' ? 443 : 80));

let ws = null;
let pc;
let datachannel, localdatachannel;
let audio_video_stream;
const pcConfig = {/*sdpSemantics : "plan-b"*,*/ "iceServers": [
        {"urls": ["stun:stun.l.google.com:19302", "stun:" + signalling_server_hostname + ":3478"]}
    ]};
const pcOptions = {
    optional: []
};
let mediaConstraints = {
    optional: [],
    mandatory: {
        OfferToReceiveAudio: true,
        OfferToReceiveVideo: true
    }
};
let keys = [];
let trickle_ice = true;
let remoteDesc = false;
let iceCandidates = [];

RTCPeerConnection = window.RTCPeerConnection || /*window.mozRTCPeerConnection ||*/ window.webkitRTCPeerConnection;
RTCSessionDescription = /*window.mozRTCSessionDescription ||*/ window.RTCSessionDescription;
RTCIceCandidate = /*window.mozRTCIceCandidate ||*/ window.RTCIceCandidate;
navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia || navigator.msGetUserMedia;
const URL = window.URL || window.webkitURL;

function createPeerConnection() {
    try {
        let pcConfig_ = pcConfig;
        try {
            ice_servers = "";
            if (ice_servers) {
                pcConfig_.iceServers = JSON.parse(ice_servers);
            }
        } catch (e) {
            alert(e + "\nExample: "
                    + '\n[ {"urls": "stun:stun1.example.net"}, {"urls": "turn:turn.example.org", "username": "user", "credential": "myPassword"} ]'
                    + "\nContinuing with built-in RTCIceServer array");
        }
        console.log(JSON.stringify(pcConfig_));
        pc = new RTCPeerConnection(pcConfig_, pcOptions);
        pc.onicecandidate = onIceCandidate;
        if ('ontrack' in pc) {
            pc.ontrack = onTrack;
        } else {
            pc.onaddstream = onRemoteStreamAdded; // deprecated
        }
        pc.onremovestream = onRemoteStreamRemoved;
        pc.ondatachannel = onDataChannel;
        console.log("peer connection successfully created!");
    } catch (e) {
        console.error("createPeerConnection() failed");
    }
}

function onDataChannel(event) {
    console.log("onDataChannel()");
    datachannel = event.channel;

    event.channel.onopen = function () {
        console.log("Data Channel is open!");
    };

    event.channel.onerror = function (error) {
        console.error("Data Channel Error:", error);
    };

    event.channel.onmessage = function (event) {
        console.log("Got Data Channel Message:", event.data);
        document.getElementById('datareceived').value = event.data;
    };

    event.channel.onclose = function () {
        datachannel = null;
        document.getElementById('datachannels').disabled = true;
        console.log("The Data Channel is Closed");
    };
}

function onIceCandidate(event) {
    if (event.candidate) {
        var candidate = {
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
            candidate: event.candidate.candidate
        };
        var request = {
            what: "addIceCandidate",
            data: JSON.stringify(candidate)
        };
        ws.send(JSON.stringify(request));
    } else {
        console.log("End of candidates.");
    }
}

function addIceCandidates() {
    iceCandidates.forEach(function (candidate) {
        pc.addIceCandidate(candidate,
            function () {
                console.log("IceCandidate added: " + JSON.stringify(candidate));
            },
            function (error) {
                console.error("addIceCandidate error: " + error);
            }
        );
    });
    iceCandidates = [];
}

function onRemoteStreamAdded(event) {
    console.log("Remote stream added:", event.stream);
    var remoteVideoElement = document.getElementById('remote-video');
    remoteVideoElement.srcObect = event.stream;
}

function onTrack(event) {
    console.log("Remote track!");
    var remoteVideoElement = document.getElementById('remote-video');
    remoteVideoElement.srcObject = event.streams[0];
}

function onRemoteStreamRemoved(event) {
    var remoteVideoElement = document.getElementById('remote-video');
    remoteVideoElement.srcObject = null;
    remoteVideoElement.src = ''; // TODO: remove
}

function start() {
    if ("WebSocket" in window) {
        document.documentElement.style.cursor = 'wait';
        const server = signalling_server_address.toLowerCase();

        var protocol = location.protocol === "https:" ? "wss:" : "ws:";
        ws = new WebSocket(protocol + '//' + server + '/stream/webrtc');

        function call(stream) {
            iceCandidates = [];
            remoteDesc = false;
            createPeerConnection();
            if (stream) {
                pc.addStream(stream);
            }
            const request = {
                what: "call",
                options: {
                    force_hw_vcodec: false, //document.getElementById("remote_hw_vcodec").checked,
                    vformat: "60", //document.getElementById("remote_vformat").value,
                    trickle_ice: true
                }
            };
            ws.send(JSON.stringify(request));
            console.log("call(), request=" + JSON.stringify(request));
        }

        ws.onopen = function () {
            console.log("onopen()");
            call();
        };

        ws.onmessage = function (evt) {
            console.log('onmessage called');
            var msg = JSON.parse(evt.data);
            if (msg.what !== 'undefined') {
                var what = msg.what;
                var data = msg.data;
            }
            console.log("message =" + what);

            switch (what) {
                case "offer":
                    pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data)),
                            function onRemoteSdpSuccess() {
                                remoteDesc = true;
                                addIceCandidates();
                                console.log('onRemoteSdpSucces()');
                                pc.createAnswer(function (sessionDescription) {
                                    pc.setLocalDescription(sessionDescription);
                                    var request = {
                                        what: "answer",
                                        data: JSON.stringify(sessionDescription)
                                    };
                                    ws.send(JSON.stringify(request));
                                    console.log(request);

                                }, function (error) {
                                    alert("Failed to createAnswer: " + error);

                                }, mediaConstraints);
                            },
                            function onRemoteSdpError(event) {
                                alert('Failed to set remote description (unsupported codec on this browser?): ' + event);
                                stop();
                            }
                    );

                    break;

                case "answer":
                    break;

                case "message":
                    alert(msg.data);
                    break;

                case "iceCandidate": // when trickle is enabled
                    if (!msg.data) {
                        console.log("Ice Gathering Complete");
                        break;
                    }
                    var elt = JSON.parse(msg.data);
                    let candidate = new RTCIceCandidate({sdpMLineIndex: elt.sdpMLineIndex, candidate: elt.candidate});
                    iceCandidates.push(candidate);
                    if (remoteDesc)
                        addIceCandidates();
                    document.documentElement.style.cursor = 'default';
                    break;

                case "iceCandidates": // when trickle ice is not enabled
                    var candidates = JSON.parse(msg.data);
                    for (var i = 0; candidates && i < candidates.length; i++) {
                        var elt = candidates[i];
                        let candidate = new RTCIceCandidate({sdpMLineIndex: elt.sdpMLineIndex, candidate: elt.candidate});
                        iceCandidates.push(candidate);
                    }
                    if (remoteDesc)
                        addIceCandidates();
                    document.documentElement.style.cursor = 'default';
                    break;
            }
        };

        ws.onclose = function (evt) {
            if (pc) {
                pc.close();
                pc = null;
            }

            document.documentElement.style.cursor = 'default';
        };

        ws.onerror = function (evt) {
            alert("An error has occurred!");
            ws.close();
        };

    } else {
        alert("Sorry, this browser does not support WebSockets.");
    }
}

function stop() {
    if (datachannel) {
        console.log("closing data channels");
        datachannel.close();
        datachannel = null;
        document.getElementById('datachannels').disabled = true;
    }
    if (localdatachannel) {
        console.log("closing local data channels");
        localdatachannel.close();
        localdatachannel = null;
    }
    if (audio_video_stream) {
        try {
            if (audio_video_stream.getVideoTracks().length)
                audio_video_stream.getVideoTracks()[0].stop();
            if (audio_video_stream.getAudioTracks().length)
                audio_video_stream.getAudioTracks()[0].stop();
            audio_video_stream.stop(); // deprecated
        } catch (e) {
            for (var i = 0; i < audio_video_stream.getTracks().length; i++)
                audio_video_stream.getTracks()[i].stop();
        }
        audio_video_stream = null;
    }

    document.getElementById('remote-video').srcObject = null;

    if (pc) {
        pc.close();
        pc = null;
    }
    if (ws) {
        ws.close();
        ws = null;
    }

    document.documentElement.style.cursor = 'default';
}

function mute() {
    const remoteVideo = document.getElementById("remote-video");
    remoteVideo.muted = !remoteVideo.muted;
}

function pause() {
    const remoteVideo = document.getElementById("remote-video");

    if (remoteVideo.paused)
        remoteVideo.play();
    else
        remoteVideo.pause();
}

function fullscreen() {
    var remoteVideo = document.getElementById("remote-video");
    if (remoteVideo.requestFullScreen) {
        remoteVideo.requestFullScreen();
    } else if (remoteVideo.webkitRequestFullScreen) {
        remoteVideo.webkitRequestFullScreen();
    } else if (remoteVideo.mozRequestFullScreen) {
        remoteVideo.mozRequestFullScreen();
    }
}

window.onload = function () {
    if (true) {
        start();
    }
};

window.onbeforeunload = function () {
    if (ws) {
        ws.onclose = function () {}; // disable onclose handler first
        stop();
    }
};

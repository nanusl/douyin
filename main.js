const {
    app,
    BrowserWindow
} = require("electron");
const ipc = require('electron').ipcMain;
const globalShortcut = require('electron').globalShortcut;
const electronLocalshortcut = require("electron-localshortcut");
const axios = require('axios');
const md5 = require('./md5.min.js');
let userData = app.getPath('userData');
let Datastore = require('nedb'),
    db = new Datastore({
        filename: userData + 'ne.db',
        autoload: true
    });
let win, pageUrl, riskInfos = [], cursor = 0;
let show = true;

function getPageUrl() {
    if (riskInfos.length === 0) {
        let url = "dbTest?cursor=" + cursor + "&count=6";
        let r = generateRandom().toString();
        let parseTempStr = url + '@&^' + r;
        let parseStr = generateStr(parseTempStr);
        url = url + '&e=' + parseStr + '&r=' + r;
        axios.get('https://www.welltool.net/' + url, {
            timeout: 4000
        }).then((response) => {
            if (response.data.status === 0) {
                riskInfos = response.data.data;
                cursor = response.data.cursor;
                getRiskInfo(riskInfos.shift());
            } else {
                win.webContents.send('error', 'error');
            }
        }).catch((error) => {
            win.webContents.send('error', '请求失败，请检查网络环境以及与服务器连接是否正常');
        });
    } else {
        getRiskInfo(riskInfos.shift());
    }
}

function generateRandom() {
    return Math.random().toString(10).substring(2);
}

function generateStr(url) {
    return md5(url);
}

function getRiskInfo(info) {
    win.webContents.send('refresh', info.share_url);
    //isLoved(info.share_url);
}

function createWindow() {
    win = new BrowserWindow({
        width: 350,
        height: 800,
        webPreferences: {
            webSecurity: false
        }
    });
    win.openDevTools();
    electronLocalshortcut.register(win, "Down", () => {
        win.webContents.send('next', {});
    });

    electronLocalshortcut.register(win, "Up", () => {
        win.webContents.send('prev', {});
    });

    electronLocalshortcut.register(win, "Left", () => {
        getPageUrl();
    });

    electronLocalshortcut.register(win, "Right", () => {
        getPageUrl();
    });

    win.on("closed", () => {
        win = null;
    });
}


function isLoved(url) {
    db.find({
        url
    }, (err, docs) => {
        if (docs.length > 0) {
            win.webContents.send('isLoved', true);
        } else {
            win.webContents.send('isLoved', false);
        }
    });
}

app.on("ready", () => {
    createWindow();
    win.loadFile("recommend.html");

    globalShortcut.register('alt+q', () => {
        if (show) {
            win.hide();
            show = false;
        } else {
            win.show();
            show = true;
        }
        win.webContents.send('pause', {});
    });
});

app.on("activate", () => {
    if (win === null) {
        createWindow();
        win.loadFile("recommend.html");
    }
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

ipc.on('refresh', (event, message) => {
    if (pageUrl == null) {
        getPageUrl();
    } else {
        win.webContents.send('refresh', pageUrl);
        isLoved(pageUrl);
        pageUrl = null;
    }
});

ipc.on('changeTab', (event, message) => {
    win.loadFile(message);
});

ipc.on('play', (event, url) => {
    pageUrl = url;
    win.loadFile("recommend.html");
});

ipc.on('love', (event, message) => {
    let doc = {
        "url": message.url,
        "description": message.description,
        "cover": message.cover,
        "time": Date.now()
    };
    db.insert(doc, (err, newDoc) => {
        isLoved(message.url);
    });
});

ipc.on('getPageUrl', (event, message) => {
    getPageUrl();
});

ipc.on("isLoved", (event, message) => {
    isLoved(message.url);
})

ipc.on('unlove', (event, url) => {
    db.remove({
        url
    }, {}, (err, numRemoved) => {
        isLoved(url);
    });
});

ipc.on('listLove', (event, message) => {
    db.find({}).sort({
        time: -1
    }).exec((err, docs) => {
        win.webContents.send('listLove', docs);
    });
});

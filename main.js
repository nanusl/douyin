const {
    app,
    BrowserWindow
} = require("electron");
const ipc = require('electron').ipcMain
const globalShortcut = require('electron').globalShortcut;
const electronLocalshortcut = require("electron-localshortcut");
const axios = require('axios');
let userData = app.getPath('userData');
let Datastore = require('nedb'),
    db = new Datastore({
        filename: userData + 'ne.db',
        autoload: true
    });
let win, pageUrl;
let show = true;

function getPageUrl() {
    axios.get('https://dy.lujianqiang.com', {
        timeout: 4000
    }).then(function (response) {
        let package = require("./package.json");
        if (response.data.version > package.version) {
            win.webContents.send('version', 'update');
        }
        if (response.data.code === 0) {
            win.webContents.send('refresh', response.data.url);
            isLoved(response.data.url);
        } else {
            win.webContents.send('error', response.data.message);
        }
    }).catch(function (error) {
        win.webContents.send('error', '请求失败，请检查网络环境以及与服务器连接是否正常');
    });
}

function createWindow() {
    win = new BrowserWindow({
        width: 350,
        height: 750,
        webPreferences: {
            webSecurity: false
        }
    });
    /*win.openDevTools();*/
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
    }, function (err, docs) {
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

    globalShortcut.register('alt+q', function () {
        if (show) {
            win.hide();
            show = false;
        } else {
            win.show();
            show = true;
        }
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

ipc.on('refresh', function (event, message) {
    if (pageUrl == null) {
        getPageUrl();
    } else {
        win.webContents.send('refresh', pageUrl);
        isLoved(pageUrl);
        pageUrl = null;
    }
});

ipc.on('changeTab', function (event, message) {
    win.loadFile(message);
});

ipc.on('play', function (event, url) {
    pageUrl = url;
    win.loadFile("recommend.html");
});

ipc.on('love', function (event, message) {
    let doc = {
        "url": message.url,
        "description": message.description,
        "cover": message.cover,
        "time": Date.now()
    };
    db.insert(doc, function (err, newDoc) {
        isLoved(message.url);
    });
});
ipc.on('getPageUrl', function (event, message) {
    getPageUrl();
});

ipc.on('unlove', function (event, url) {
    db.remove({
        url
    }, {}, function (err, numRemoved) {
        isLoved(url);
    });
});

ipc.on('listLove', function (event, message) {
    db.find({}, function (err, docs) {
        win.webContents.send('listLove', docs);
    })
});

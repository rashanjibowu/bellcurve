// main process

const {app, BrowserWindow, ipcMain} = require('electron');

const path = require('path');
const url = require('url');

let mainWindow;
let aboutWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 850,
        height: 400,
        title: 'BellCurve',
        resizable: false,
        frame: false,
        show: false,
        icon: path.join(__dirname, 'assets/icons/png/64x64.png')
    });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'main.html'),
        protocol: 'file',
        slashes: true
    }));

    mainWindow.setMenu(null);
    //mainWindow.webContents.openDevTools();

    mainWindow.on('closed', function() {
        mainWindow = null;

        if (aboutWindow) {
            aboutWindow.close();
        }
    });

    mainWindow.on('ready-to-show', function() {
        mainWindow.show();
    });
}

function launchCredits() {

    if (!aboutWindow) {
        aboutWindow = new BrowserWindow({
            width: 475,
            height: 500,
            alwaysOnTop: true,
            resizable: false,
            fullscreenable: false,
            title: 'About BellCurve'
        });
    }

    aboutWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'about.html'),
        protocol: 'file',
        slashes: true
    }));

    aboutWindow.setMenu(null);

    aboutWindow.on('closed', function() {
        aboutWindow = null;
    });
}

app.on('ready', createWindow);

ipcMain.on('show-about', function(event, arg) {
    launchCredits();
});

ipcMain.on('close-app', function(event, arg) {
    mainWindow.close();
});
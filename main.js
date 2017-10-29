// main process

const {app, BrowserWindow, ipcMain} = require('electron');

const path = require('path');
const url = require('url');
require('dotenv').config();

let mainWindow;
let aboutWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 850,
        height: 400
    });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'main.html'),
        protocol: 'file',
        slashes: true
    }));

    mainWindow.webContents.openDevTools();

    mainWindow.on('closed', function() {
        mainWindow = null;
    });
}

function launchCredits() {

    if (!aboutWindow) {
        aboutWindow = new BrowserWindow({
            width: 400,
            height: 450,
            alwaysOnTop: true,
            resizable: false,
            fullscreenable: false,
            title: 'About App'
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
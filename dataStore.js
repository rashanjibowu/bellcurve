// Data Store
// Download data from internet, store in flat file, and retrieve for use in application

const electron = require('electron');
const path = require('path');
const fs = require('fs');

function DataStore() {

    this.path = (electron.app || electron.remote.app).getPath('userData');
}

// download data and save to disk
DataStore.prototype.download = function(ticker, type, callback) {
    console.log('Downloading %s for %s', type, ticker);      

    // set paths for directory and file
    var directoryPath = path.join(this.path, ticker);
    var filePath = path.join(directoryPath, type.concat('.txt'));
    
    try {

        var today = new Date();
        let value;

        // retrieve data from internet
        if (type == 'currentPrice') {
            value = today.toISOString().concat('|', 80); 
        } else {
            value = [];
            for (var i = 0; i < 365; i++) {
                value.push(new Date(today - (1000 * 60 * 60 * 24 * i)).toISOString().concat('|', (Math.random() * 80).toFixed(2)));
            }
            value = value.join('\n');
        }        

        console.log('Successful download');
        console.log(value);

        // if the directory does not exist, we must create it
        fs.access(directoryPath, fs.constants.W_OK, function(error) {
            
            if (error) {
                console.warn('Directory does not exist. Creating it...');
                fs.mkdir(directoryPath, function(error) {
                    if (error) {
                        console.error('Unable to create directory');
                        return;
                    } else {
                        console.log('Directory is created!');
                    }
                });
            }
            
            // then we save the data to a file
            fs.writeFile(filePath, value, 'utf-8', function(error) {
                if (error) {
                    console.error(error);
                    callback(error);
                    return;
                } else {                    
                    callback(null);
                }
            });
        });
    } catch (error) {
        callback(error);
    }
};

// retrieve data from disk
// if data does not exist, download from internet
// if data is old, download from internet
// for price history, old means greater than 1 week old
// for current price, old means greater than 1 day (or as specified in app)
DataStore.prototype.retrieve = function(ticker, type, callback) {

    // set paths for directory and file
    var directoryPath = path.join(this.path, ticker);
    var filePath = path.join(directoryPath, type.concat('.txt'));
    
    var self = this;
    fs.readFile(filePath, 'utf-8', function(readError, data) {
    
        // if we can't read, attempt to download
        if (readError) {
            console.warn('Can\'t read. Attempting to download...');
            try {
                self.download(ticker, type, function(downloadError) {

                    if (downloadError) {
                        console.error('Unable to read data from disk or download data');
                        callback(downloadError);
                        return;
                    }

                    // successful download, read again
                    fs.readFile(filePath, 'utf-8', function(error, recentData) {
                        if (error) {
                            console.error('Still unable to read data from disk or download data');
                            callback(error);
                            return;
                        }

                        console.log('We found recently downloaded data!');                        
                        callback(null, recentData);
                    });
                });
            } catch (error) {
                console.error('Unable to read data from disk or download data');
                callback(error);
                return;
            }
        } else {
            // we found the data
            console.log('We found a saved version!');
            console.log(data);

            // if data is old, re-download
            const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;
            var date = data.split('|')[0];
            var now = new Date();
            if (date == '' || new Date(date) < (now - MILLIS_PER_DAY)) {
                console.log('But, the data looks old. We need to download fresh data...');

                try {
                    self.download(ticker, type, function(downloadError) {
    
                        if (downloadError) {
                            console.error('Unable to read data from disk or download data');
                            callback(downloadError);
                            return;
                        }
    
                        // successful download, read again
                        fs.readFile(currentPriceFile, 'utf-8', function(error, recentData) {
                            if (error) {
                                console.error('Still unable to read data from disk or download data');
                                callback(error);
                                return;
                            }
    
                            console.log('We found recently downloaded data!');
                            callback(null, recentData);
                        });
                    });
                } catch (error) {
                    console.error('Unable to read data from disk or download data');
                    callback(error);
                    return;
                }
            } else {
                callback(null, data);
            }            
        }        
    });
};

// initial retrieval and analysis of data associated with the provided ticker
// this is to be run on app load
DataStore.prototype.initialize = function(ticker, days) {

    console.log('Initializing...');

    var targetPrice = 95;
    var currentPrice = 80;
    var meanReturnAnnual = 0.05;
    var historicalVolatility = 0.14;
    var impliedVolatility = 0.35;

    return {
        ticker: ticker,
        targetPrice: targetPrice,
        currentPrice: currentPrice,
        priceHistory: null,
        days: days,
        meanReturnAnnual: meanReturnAnnual,
        historicalVolatility: historicalVolatility,
        impliedVolatility: impliedVolatility
    };
};

module.exports = DataStore;
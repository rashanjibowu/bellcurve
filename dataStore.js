// Data Store
// Download data from internet, store in flat file, and retrieve for use in application

const electron = require('electron');
const path = require('path');
const fs = require('fs');
const math = require('mathjs');
const utils = require('./utils.js');
const request = require('request');

function DataStore() {

    this.path = (electron.app || electron.remote.app).getPath('userData');
}

// download data and save to disk
// there is no difference between downloading the current price and a price history
DataStore.prototype.download = function(ticker, type, callback) {
    console.log('Downloading %s for %s', type, ticker);      

    // set paths for directory and file
    var directoryPath = path.join(this.path, ticker);
    var filePath = path.join(directoryPath, type.concat('.txt'));
    
    var resourceURL = 'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=MSFT&apikey=demo&datatype=csv';
    var self = this;

    request(resourceURL, function(error, response, body) {
        if (error) {
            callback(error);
            return;
        }

        if (response.statusCode != 200) {
            callback('Error: '.concat(response.statusCode));
            return;
        }

        console.log('Successful download');        

        // check for the existence of the destination directory
        fs.access(directoryPath, fs.constants.W_OK, function(error) {
        
            // if the directory does not exist, we must create it
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
            fs.writeFile(filePath, body, 'utf-8', function(error) {
                if (error) {
                    console.error(error);
                    callback(error);
                    return;
                } else {                    
                    callback(null);
                }
            });
        });

        var priceHistory = self.parsePriceHistory(body)          

        callback(null, priceHistory);
    });        
};

// covert stored csv format into array of objects
DataStore.prototype.parsePriceHistory = function(rawData) {

    // parse the data
    console.log('Parsing the data ...');
    var lines = rawData.split('\n');

    var priceHistory = lines.map(function(line, index) {
        if (index == 0) {
            return {};
        }

        var values = line.split(',');
        var date = new Date(values[0]);
        return {
            timestamp: Date.parse(values[0]),
            open: +values[1],
            high: +values[2],
            low: +values[3],
            close: +values[4],
            volume: +values[5]
        }
    }); 

    // remove header
    priceHistory.shift();

    // remove last element if it's functionally empty
    if (!priceHistory[(priceHistory.length - 1)].timestamp) {
        priceHistory.pop();
    }    
    
    return priceHistory;
};

// retrieve data from disk
// if data does not exist, download from internet
// if data is old, download from internet
// for price history, old means greater than 1 week old
// for current price, old means greater than 1 day (or as specified in app)
DataStore.prototype.retrieve = function(ticker, type, callback) {

    console.log('Trying to retrieve %s', type);

    // set paths for directory and file
    var directoryPath = path.join(this.path, ticker);
    var filePath = path.join(directoryPath, type.concat('.txt'));
    
    var self = this;
    fs.readFile(filePath, 'utf-8', function(readError, data) {
    
        // if we can't read, attempt to download
        if (readError) {
            console.warn('Can\'t read. Attempting to download...');

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
                    callback(null, self.parsePriceHistory(recentData));
                });
            });            
        } else {
            // we found the data
            console.log('We found a saved version!');

            // if data is old, re-download
            const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;
            data = self.parsePriceHistory(data);

            var date = data[0].timestamp;
            var now = new Date();
            if (new Date(date) < (now - MILLIS_PER_DAY)) {
                console.log('But, the data looks old. We need to download fresh data...');
                
                self.download(ticker, type, function(downloadError) {

                    if (downloadError) {
                        console.warn('Unable to read data from disk or download data. Using old data');
                        callback(null, data);
                        return;
                    }

                    // successful download, read again
                    fs.readFile(filePath, 'utf-8', function(error, recentData) {
                        if (error) {
                            console.warn('Still unable to read data from disk or download data. Using old data');
                            callback(null, data);
                            return;
                        }

                        console.log('We found recently downloaded data!');
                        callback(null, self.parsePriceHistory(recentData));
                    });
                });
            } else {
                callback(null, data);
            }            
        }        
    });
};

// initial retrieval and analysis of data associated with the provided ticker
// this is to be run on app load
DataStore.prototype.initialize = function(ticker, days, callback) {

    var impliedVolatility = null;
    const TRADING_DAYS_PER_YEAR = 252;
    const INITIAL_TARGET_RETURN = 0.10;

    this.retrieve(ticker, 'priceHistory', function(error, data) {

        if (error) {
            console.error(error);
            return;
        }

        let priceHistory = data;
        
        // assume that we are starting from a price history
        // calculate daily returns and volatility
        var returnsHistory = utils.returnHistory(priceHistory);
    
        // calculate mean and standard deviation of returns
        var meanDailyReturn = utils.meanReturn(returnsHistory);
        var stdDailyReturn = utils.stdReturn(returnsHistory);
    
        // since the history of returns is daily, they must be converted into annual
        // annualize returns    
        var meanAnnualReturn = utils.scaleReturn(meanDailyReturn, TRADING_DAYS_PER_YEAR);
    
        // annualize volatility
        var stdAnnualReturn = utils.scaleVolatility(stdDailyReturn, TRADING_DAYS_PER_YEAR);    
    
        var initialState = {
            ticker: ticker,
            targetPrice: priceHistory[0].close * (1 + INITIAL_TARGET_RETURN),
            currentPrice: priceHistory[0].close,
            priceHistory: priceHistory,
            days: days,
            meanAnnualReturn: meanAnnualReturn,
            stdAnnualReturn: stdAnnualReturn,
            impliedVolatility: impliedVolatility,
            meanDailyReturn: meanDailyReturn,
            stdDailyReturn: stdDailyReturn
        };
    
        callback(null, initialState);
    });
};

module.exports = DataStore;
// Data Store
// Download data from internet, store in flat file, and retrieve for use in application

const electron = require('electron');
const path = require('path');
const fs = require('fs');
const math = require('mathjs');
const utils = require('./utils.js');
const request = require('request');
const dotenv = require('dotenv');
dotenv.config();

/**
 * Constructor for data store
 */
function DataStore() {

    this.path = (electron.app || electron.remote.app).getPath('userData');
}

/**
 * Downloads data and saves to disk
 * @param   {string}    ticker      Stock ticker
 * @param   {string}    type        Type of data to download -- 'priceHistory'
 * @param   {function}  callback    Function to call when execution is complete
 * @return  {void}
 */
DataStore.prototype.download = function(ticker, type, callback) {
    console.log('Downloading %s for %s', type, ticker);

    // set paths for directory and file
    var directoryPath = path.join(this.path, ticker);
    var filePath = path.join(directoryPath, type.concat('.txt'));

    var apiKey = process.env.ALPHAVANTAGE_API_KEY;

    var resourceURL = 'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY';
    resourceURL = resourceURL.concat('&symbol=', ticker);
    resourceURL = resourceURL.concat('&apikey=', apiKey);
    resourceURL = resourceURL.concat('&datatype=csv');
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

        // check for the existence of the destination directory
        fs.access(directoryPath, fs.constants.W_OK, function(error) {

            // if the directory does not exist, we must create it
            if (error) {
                console.warn('Directory does not exist. Creating it...');
                fs.mkdir(directoryPath, function(error) {
                    if (error) {
                        callback('Unable to create directory');
                        return;
                    }
                });
            }

            // then we save the data to a file
            fs.writeFile(filePath, body, 'utf-8', function(error) {
                if (error) {
                    callback(error);
                    return;
                } else {
                    callback(null);
                }
            });
        });
    });
};

/**
 * Convert stored CSV format into array of objects
 * @param   {string}    rawData     The data stored in the download
 * @return  {array}                 Formatted price history
 */
DataStore.prototype.parsePriceHistory = function(rawData) {

    // parse the data
    var lines = rawData.split('\n');

    var priceHistory = [];

    for (var i = 0; i < lines.length; i++) {
        var values = lines[i].split(',');

        if (values.length == 6 && i > 0) {
            priceHistory.push({
                timestamp: values[0],
                open: +values[1],
                high: +values[2],
                low: +values[3],
                close: +values[4],
                volume: +values[5]
            });
        }
    }

    return priceHistory;
};

/**
 * Retrieves data from disk
 * If data does not exist or is old, it is re-downloaded from internet.
 * @param   {string}    ticker      Stock ticker
 * @param   {string}    type        Type of data to download -- 'priceHistory'
 * @param   {function}  callback    Function to call when execution is complete
 * @return  {void}
 */
DataStore.prototype.retrieve = function(ticker, type, callback) {

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
                    callback(downloadError);
                    return;
                }

                // successful download, read again
                fs.readFile(filePath, 'utf-8', function(error, recentData) {
                    if (error) {
                        callback(error);
                        return;
                    }

                    callback(null, self.parsePriceHistory(recentData));
                });
            });
        } else {
            // we found the data
            // if data is old, re-download
            const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;
            data = self.parsePriceHistory(data);

            var date = data[0].timestamp;
            var now = new Date();
            if (new Date(date) < (now - MILLIS_PER_DAY)) {
                console.warn('Data looks old. Attempting to download fresh data...');

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

                        callback(null, self.parsePriceHistory(recentData));
                    });
                });
            } else {
                callback(null, data);
            }
        }
    });
};

/**
 * Initial retrieval and analysis of data associated with the provided ticker
 * To be executed on app load
 * @param   {string}    ticker      Stock ticker
 * @param   {string}    days        Number of days to consider
 * @param   {function}  callback    Function to call when execution is complete
 */
DataStore.prototype.initialize = function(ticker, days, callback) {

    var impliedVolatility = null;
    const TRADING_DAYS_PER_YEAR = 252;
    const INITIAL_TARGET_RETURN = 0.10;

    this.retrieve(ticker, 'priceHistory', function(error, data) {

        if (error) {
            callback(error);
            return;
        }

        if (data.length == 0) {
            callback('No data found');
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

/**
 * Fetches the current price of the ticker
 * @param   {string}    ticker      Stock ticker
 * @param   {function}  callback    Function to call when execution ends
 * @return  {void}
 */
DataStore.prototype.currentPrice = function(ticker, callback) {

    var apiKey = process.env.ALPHAVANTAGE_API_KEY;

    var resourceURL = 'https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY';
    resourceURL = resourceURL.concat('&symbol=', ticker);
    resourceURL = resourceURL.concat('&interval=1min');
    resourceURL = resourceURL.concat('&apikey=', apiKey);
    resourceURL = resourceURL.concat('&datatype=csv');

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

        // return data on success; the first element in array is most recent price
        var intradayPriceHistory = self.parsePriceHistory(body);
        callback(null, intradayPriceHistory[0].close);
    });
};

module.exports = DataStore;
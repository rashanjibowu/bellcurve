/**
 * Data Store
 * This class manages the downloading and retrieval of price history and current pricing data
 */

const electron = require('electron');
const math = require('mathjs');
const utils = require('./utils.js');
const request = require('request');

/**
 * Constructor for data store
 */
function DataStore() {}

/**
 * Requests data using an API service
 * @param   {string}    ticker      Stock ticker
 * @param   {string}    type        Type of data to fetch; either 'priceHistory' or 'currentPrice'
 * @param   {function}  callback    Function to call when execution is complete
 * @return  {void}
 */
DataStore.prototype.fetch = function(ticker, type, callback) {

    var resourceURL = 'https://bellcurveapi.herokuapp.com/api/'.concat(type, '?symbol=', ticker);

    request(resourceURL, function(error, response, body) {

        if (error) {
            callback(error);
            return;
        }

        if (response.statusCode != 200) {
            callback('Error: '.concat(response.statusCode));
            return;
        }

        callback(null, JSON.parse(body));
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

    var self = this;

    this.fetch(ticker, 'priceHistory', function(phError, phData) {

        if (phError) {
            callback(phError);
            return;
        }

        if (phData.length === 0) {
            callback('No data found');
            return;
        }

        self.fetch(ticker, 'currentPrice', function(cpError, cpData) {

            if (cpError) {
                callback(cpError);
                return;
            }

            if (cpData.length === 0) {
                callback('No data found');
                return;
            }

            // price history and current price are now available

            let priceHistory = phData;
            let currentHistory = cpData;

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
                targetPrice: priceHistory[(priceHistory.length - 1)].close * (1 + INITIAL_TARGET_RETURN),
                currentPrice: currentHistory[(currentHistory.length - 1)].close,
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
    });
};

module.exports = DataStore;
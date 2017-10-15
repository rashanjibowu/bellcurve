// Utility functions

var jStat = require('jStat').jStat;
var math = require('mathjs');

const TRADING_DAYS_PER_YEAR = 252;

module.exports = {

    /**
     * Returns the 1 standard deviation move over the given number of days
     * @param   {number}    currentPrice    Current price of stock
     * @param   {number}    dailyVolatility Standard deviation of annual returns
     * @param   {number}    days            Number of days to consider
     * @return  {array}                     Two-element array containing the expected move
     */
    expectedMove: function(currentPrice, annualVolatility, days) {
        var min = currentPrice - currentPrice * annualVolatility * Math.sqrt(days / TRADING_DAYS_PER_YEAR);
        var max = currentPrice + currentPrice * annualVolatility * Math.sqrt(days / TRADING_DAYS_PER_YEAR);
        return [min, max];
    },

    /**
     * Return the distribution of potential returns within 3 standard deviations
     * @param   {number}    mean    The mean return
     * @param   {number}    sigma   The standard deviation of returns
     * @param   {number}    days    The number of days to consider
     * @return  {array}             Array of objects used to draw the probability density curve
     */
    returnDistribution: function(mean, sigma, days) {        
    
        // mean is assumed to be an annualized return
        // we need to scale the return to reflect the number of days provided
        mean = Math.pow(1 + mean, days / 365) - 1;
        mean = 0;
    
        // sigma is assumed to be an annualized volatility
        // we need to scale the volatility to reflect the number of days provided
        sigma = sigma * Math.sqrt(days / 365);
    
        var data = [];
        var minX = mean - 3 * sigma;
        var maxX = mean + 3 * sigma;
        var incr = (maxX - minX) / 100;
    
        for (var i = minX; i <= maxX; i = i + incr) {        
    
            data.push({
                probabilityDensity: jStat.normal.pdf(i, mean, sigma),
                observation: i
            });
        }
    
        // return sorted data
        return data;
    },

    /**
     * Returns a distribution of prices corresponding to the provided distribution of returns
     * @param   {number}    currentPrice        The current price of the stock
     * @param   {array}     returnDistribution  The distribution of returns
     * @return  {array}                         Distribution of prices
     */
    priceDistribution: function(currentPrice, returnDistribution) {
        return returnDistribution.map(function(value) {
            value.price = currentPrice * (1 + value.observation);
            return value;
        });
    },

    /**
     * Returns the daily returns from a time series of prices
     * Assumes the price history is in ascending date order
     * @param   {array}  priceHistory    Array of objects containing the price history as a time series
     * @return  {array}                  Array of objects containing a history of returns
     */
    returnHistory: function(priceHistory) {  

        return priceHistory.map(function(value, index, array) {
            var r = {
                date: value.timestamp
            };

            if (index == 0) {
                r.return = 0
            } else {
                // current / previous - 1
                r.return = array[index].close / array[(index - 1)].close - 1;
            }

            return r;
        });
    },

    /**
     * Returns the mean of daily returns
     * @param   {array} returnsHistory  Array of returns
     * @return  {number}                Mean daily return
     */
    meanReturn: function(returnsHistory) {
        return math.mean(returnsHistory.map(function(value) {
            return value.return;
        }));
    },

    /**
     * Converts daily return to periodic return over the given number of days
     * @param   {number}    dailyReturn Daily return
     * @param   {number}    days        Number of days represented by figure
     * @return  {number}                Periodic return
     */
    scaleReturn: function(dailyReturn, days) {
        return Math.pow(dailyReturn + 1, days) - 1;   
    },

    /**
     * Returns the standard deviation of daily returns
     * @param   {array} returnsHistory  Array of returns
     * @return  {number}                Standard deviation of daily returns
     */
    stdReturn: function(returnsHistory) {
         return math.std(returnsHistory.map(function(value) {
            return value.return;
        }));
    },

    /**
     * Converts daily volatility to periodic volatility over the given number of days
     * @param   {number}    dailyVolatility Daily volatility
     * @param   {number}    days            Number of days represented by figure
     * @return  {number}                    Periodic volatility
     */
    scaleVolatility: function(dailyVolatility, days) {
        return dailyVolatility * Math.sqrt(days);
    },

    /**
     * Returns the percentage change between the target and current prices
     * @param   {number}    currentPrice    The stock's current price
     * @param   {number}    targetPrice     The desired price of the stock
     * @return  {number}                    Percentage change between target and current prices
     */
    impliedReturn: function(currentPrice, targetPrice) {
        return targetPrice / currentPrice - 1;
    },

    /**
     * Returns the probability of reaching a target price
     * Uses the cumulative probability distribution function
     * @param   {number}    currentPrice    The stock's current price
     * @param   {number}    targetPrice     The desired price of the stock
     * @param   {number}    mean            The average return of the stock
     * @param   {number}    volatility      The volatility of the returns of the stock
     * @return  {number}                    Probability of reaching a target price
     */
    probabilityOfOutcome: function(currentPrice, targetPrice, mean, volatility) {
        // find the return implied by the target price
        var impliedReturn = this.impliedReturn(currentPrice, targetPrice);

        // use cumulative probability function to determine the probability that 
        // the return will take on the implied return value
        var prob = jStat.normal.cdf(impliedReturn, mean, volatility);

        if (impliedReturn > mean) {
            return 1 - prob;
        }

        return prob;
    },

    /**
     * Returns price distribution, expected move, and probabilty of desired outcome
     * @param   {number}    currentPrice    Stock's current price
     * @param   {number}    targetPrice     Desired price of the stock
     * @param   {number}    days            Number of days to consider
     * @param   {array}     priceHistory    Array of prices as a time series
     * @return  {object}                    Object containing price distribution, expected move, and probablity of desired outcome
     */
    analyze: function(currentPrice, targetPrice, days, priceHistory) {        

        // sort in ascending order
        var sorted = priceHistory.sort(function(a, b) {
            var d1 = new Date(a.timestamp);
            var d2 = new Date(b.timestamp);
            return (d1.getTime() - d2.getTime());
        });

        // calculate return history
        var returnsHistory = this.returnHistory(sorted);

        // calculate mean return
        var meanDailyReturn = this.meanReturn(returnsHistory);
        var meanAnnualReturn = this.scaleReturn(meanDailyReturn, TRADING_DAYS_PER_YEAR);

        // calculate historical volatility
        var stdDailyReturn = this.stdReturn(returnsHistory);
        var stdAnnualReturn = this.scaleVolatility(stdDailyReturn, TRADING_DAYS_PER_YEAR);
        var stdPeriodicReturn = this.scaleVolatility(stdDailyReturn, days);        

        // returns are normally distributed
        var distributionOfReturns_HV = this.returnDistribution(meanAnnualReturn, stdAnnualReturn, days);

        // prices are derived from the returns
        var data_HV = this.priceDistribution(currentPrice, distributionOfReturns_HV);

        // calculate expected moves
        var expectedMove_HV = this.expectedMove(currentPrice, stdAnnualReturn, days);

        // prob of outcome        
        var pos = this.probabilityOfOutcome(currentPrice, targetPrice, 0, stdPeriodicReturn);

        return {
            priceDistributionHV: data_HV,
            priceDistributionIV: null,
            expectedMoveHV: expectedMove_HV,
            expectedMoveIV: null,
            probabilityOfOutcome: pos,
            stdDailyReturn: stdDailyReturn,
            returnsHistory: returnsHistory
        };
    },

    /**
     * Returns the target price given by a target return
     * @param   {number}    currentPrice    Stock's current price
     * @param   {number}    targetReturn    Desired absolute rate of return
     * @return  {number}                    Target price
     */
    updateTargetPrice: function(currentPrice, targetReturn) {
        return currentPrice * (1 + targetReturn);
    }
};
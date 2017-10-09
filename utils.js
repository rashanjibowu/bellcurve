// Utility functions

var jStat = require('jStat').jStat;
var math = require('mathjs');

const TRADING_DAYS_PER_YEAR = 252;

// calculate the gaussian y value
// what's the probability that x is from this population
function gaussian(x, mean, sigma) {
	const gaussianConstant = 1 / Math.sqrt(2 * Math.PI);
    x = (x - mean) / sigma;
    return gaussianConstant * Math.exp(-.5 * x * x) / sigma;
}

module.exports = {

    /**
     * Returns the 1 standard deviation move over the given number of days
     * @param   {number}    currentPrice    Current price of stock
     * @param   {number}    dailyVolatility Standard deviation of annual returns
     * @param   {number}    days            Number of days to consider
     * @return  [{number}]                  Two-element array containing the expected move
     */
    expectedMove: function(currentPrice, annualVolatility, days) {
        var min = currentPrice - currentPrice * annualVolatility * Math.sqrt(days / TRADING_DAYS_PER_YEAR);
        var max = currentPrice + currentPrice * annualVolatility * Math.sqrt(days / TRADING_DAYS_PER_YEAR);
        return [min, max];
    },

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

    priceDistribution: function(currentPrice, returnDistribution) {
        return returnDistribution.map(function(value) {
            value.price = currentPrice * (1 + value.observation);
            return value;
        });
    },

    returnHistory: function(priceHistory) {  

        // sort: make sure we are in ascending time order
        priceHistory = priceHistory.sort(function(a, b) {
            return b.timestamp - a.timestamp
        });

        return priceHistory.map(function(value, index, array) {
            var r = {};
            r.date = new Date(value.timestamp).toISOString();

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

    impliedVolatility: function(optionChain, currentPrice, dividendRate, interestRate) {
        return null;
    },

    analyze: function(currentPrice, days, priceHistory) {

        // calculate mean return
        var meanReturnAnnual = this.meanReturn(priceHistory);

        // calculate historical volatility
        var historicalVolatility = this.historicalVolatility(priceHistory);

        // calculate implied volatility
        //var impliedVolatility = this.impliedVolatility(null, currentPrice, null, null);

        // returns are normally distributed
        var distributionOfReturns_HV = this.returnDistribution(meanAnnualReturn, stdAnnualReturn, days);
        //var distributionOfReturns_IV = this.returnDistribution(meanReturnAnnual, impliedVolatility, days);

        // prices are derived from the returns
        var data_HV = this.priceDistribution(currentPrice, distributionOfReturns_HV);
        //var data_IV = this.priceDistribution(currentPrice, distributionOfReturns_IV);

        // calculate expected moves
        var expectedMove_IV = this.expectedMove(currentPrice, impliedVolatility, days);
        var expectedMove_HV = this.expectedMove(currentPrice, historicalVolatility, days);

        return {
            priceDistributionHV: data_HV,
            priceDistributionIV: null,
            expectedMoveHV: expectedMove_HV,
            expectedMoveIV: expectedMove_IV
        };
    }
};
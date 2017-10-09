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

    expectedMove: function(currentPrice, volatility, days) {
        var min = currentPrice - currentPrice * volatility * Math.sqrt(days / 365);
        var max = currentPrice + currentPrice * volatility * Math.sqrt(days / 365);
        return [min, max];
    },

    returnDistribution: function(mean, sigma, days) {
        // generate 1000 observations over 3 standard deviations
    
        // mean is assumed to be an annualized return
        // we need to scale the return to reflect the number of days provided
        mean = ((1 + mean) ^ (days / 365)) - 1
    
        // sigma is assumed to be an annualized volatility
        // we need to scale the volatility to reflect the number of days provided
        sigma = sigma * Math.sqrt(days / 365);
    
        var data = [];
        var minX = mean - 3 * sigma;
        var maxX = mean + 3 * sigma;
        var incr = (maxX - minX) / 100;
    
        for (var i = minX; i <= maxX; i = i + incr) {        
    
            data.push({
                probabilityDensity: gaussian(i, mean, sigma),
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

    meanReturn: function(prices) {
        return 0.05;
    },

    historicalVolatility: function(prices) {
        return 0.25;
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
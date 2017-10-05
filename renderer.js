// renderer process

const d3 = require('d3');
const DataStore = require('./dataStore.js');

// set up a data store
var dataStore = new DataStore();

// listen for click/change events
var tickerElement = document.getElementById('ticker');
var targetPriceElement = document.getElementById('targetPrice');
var daysElement = document.getElementById('days');

// when user changes ticker, retrieve/download current and historical pricing data
// recalculate probabilities
// update chart
tickerElement.addEventListener('click', function(event) {
    
    // capture the new ticker input
    var newTicker = 'COF';
    console.log('New ticker is %s!', newTicker);

    dataStore.retrieve(ticker, 'currentPrice', function(error, data) {

        if (error) {
            console.error(error);
            return;
        }

        var split = data.split('|');
        console.info('Price: $%0.2f | Date: %s', +split[1], split[0]);

        // recalculate probabilities
        console.log('Recalculating probabilities...');

        // update chart
        console.log('Updating chart...');
    });    
});

// when user changes target price, update analysis and chart
targetPriceElement.addEventListener('click', function(event) {
    // recalculate probabilities
    console.log('Recalculating probabilities...');
    
    // update chart
    console.log('Updating chart...');
});

// when user changes days, update analysis and chart
daysElement.addEventListener('click', function(event) {
    // recalculate probabilities
    console.log('Recalculating probabilities...');
    
    // update chart
    console.log('Updating chart...');
});

// calculate inputs
var currentPrice = 20;
var days = 30;
var meanReturnAnnual = 0.05;
var historicalVolatility = 0.14;
var impliedVolatility = 0.35;

// returns are normally distributed
var distributionOfReturns_HV = getReturnDistribution(meanReturnAnnual, historicalVolatility, days);
var distributionOfReturns_IV = getReturnDistribution(meanReturnAnnual, impliedVolatility, days);

// prices are derived from the returns
var data_HV = calcPriceDistribution(currentPrice, distributionOfReturns_HV);
var data_IV = calcPriceDistribution(currentPrice, distributionOfReturns_IV);

// set up line chart
var margin = { top: 20, right: 20, bottom: 20, left: 40 };
var svg = d3.select('svg');
var width = +svg.attr('width') - margin.left - margin.right;
var height = +svg.attr('height') - margin.top - margin.bottom;

var g = svg.append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
    .classed('blend-wrapper', true);

// scales
var xExtent_HV = d3.extent(data_HV, function(d) { return d.price; });
var yExtent_HV = d3.extent(data_HV, function(d) { return d.probabilityDensity; });

var xExtent_IV = d3.extent(data_IV, function(d) { return d.price; });
var yExtent_IV = d3.extent(data_IV, function(d) { return d.probabilityDensity; });

var xExtent = [];
xExtent[0] = Math.min(xExtent_HV[0], xExtent_IV[0]);
xExtent[1] = Math.max(xExtent_HV[1], xExtent_IV[1]);

var yExtent = [];
yExtent[0] = Math.min(yExtent_HV[0], yExtent_IV[0]);
yExtent[1] = Math.max(yExtent_HV[1], yExtent_IV[1]);

var xScale = d3.scaleLinear().range([0, width]);
var yScale = d3.scaleLinear().range([height, 0]);

// line interpolater
var line = d3.line()
    .x(function(d) { return xScale(d.price); })
    .y(function(d) { return yScale(d.probabilityDensity); });

// area intepolater
var area = d3.area()
    .x(function(d) { return xScale(d.price); })
    .y1(function(d) { return yScale(d.probabilityDensity); });

// use the min and max of data to focus drawing range
xScale.domain(xExtent);
yScale.domain(yExtent);

// draw the x axis
g.append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(xScale))
    .select(".domain")
    .remove();

// draw the y axis
g.append("g")
    .call(d3.axisLeft(yScale))
    .append("text")
    .attr("fill", "#000")
    .attr("transform", "rotate(-90)")
    .attr("y", 6)
    .attr("dy", "0.71em")
    .attr("text-anchor", "end");

// draw area chart first

// set the bottom of the area chart
area.y0(yScale(yExtent[0]));

var mixBlendMode = 'difference';
var opacity = 0.4;

var areaGroups = g.append('g')
    .classed('area-charts', true)
    .style('isolation', 'isolate');

areaGroups.append("path")
    .datum(data_HV)
    .attr("fill", "#a6cee3")
    .style('opacity', opacity)
    .style('mix-blend-mode', mixBlendMode)
    .attr("d", area);

areaGroups.append("path")
    .datum(data_IV)
    .attr("fill", "#b2df8a")
    .style('opacity', opacity)
    .style('mix-blend-mode', mixBlendMode)
    .attr("d", area);

// draw the line
g.append("path")
    .datum(data_IV)
    .attr("fill", "none")
    .attr("stroke-linejoin", "round")
    .attr("stroke-linecap", "round")
    .attr("stroke-width", 1.5)
    .attr('stroke', '#33a02c')
    .attr("d", line);

g.append("path")
    .datum(data_HV)
    .attr("fill", "none")
    .attr("stroke-linejoin", "round")
    .attr("stroke-linecap", "round")
    .attr("stroke-width", 1.5)
    .attr('stroke', '#1f78b4')
    .attr("d", line);

// draw vertical line at current price
g.append('line')
    .attr('x1', xScale(currentPrice))
    .attr('x2', xScale(currentPrice))
    .attr('y1', yScale(yExtent[0]))
    .attr('y2', yScale(yExtent[1]))
    .attr('stroke-width', 1)
    .attr('stroke', 'red')
    .attr('fill', 'none');

// draw vertical lines at 1 standard deviation marks
var expectedMove_IV = expectedMove(currentPrice, impliedVolatility, days);
var expectedMove_HV = expectedMove(currentPrice, historicalVolatility, days);

expectedMove_IV.concat(expectedMove_HV).forEach(function(value, index) {
    g.append('line')
        .attr('x1', xScale(value))
        .attr('x2', xScale(value))
        .attr('y1', yScale(yExtent[0]))
        .attr('y2', yScale(yExtent[1]))
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '6, 4')
        .attr('stroke', function() {
            if (index < 2) return '#33a02c';
            return '#1f78b4';
        })
        .attr('fill', 'none');
});

function expectedMove(currentPrice, volatility, days) {
    var min = currentPrice - currentPrice * volatility * Math.sqrt(days / 365);
    var max = currentPrice + currentPrice * volatility * Math.sqrt(days / 365);
    return [min, max];
}

function getReturnDistribution(mean, sigma, days) {
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
}

function calcPriceDistribution(currentPrice, returnDistribution) {
    return returnDistribution.map(function(value) {
        value.price = currentPrice * (1 + value.observation);
        return value;
    });
}

// calculate the gaussian y value
// what's the probability that x is from this population
function gaussian(x, mean, sigma) {
	const gaussianConstant = 1 / Math.sqrt(2 * Math.PI);
    x = (x - mean) / sigma;
    return gaussianConstant * Math.exp(-.5 * x * x) / sigma;
}
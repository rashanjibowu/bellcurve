// renderer process

const d3 = require('d3');
const DataStore = require('./dataStore.js');
const utils = require('./utils.js');
 
// set up a data store
var dataStore = new DataStore();

// set initial values
const TICKER = 'COF';
const DAYS = 30;
const INITIAL_TARGET_RETURN = 0.10;
let data;
let analysis;

// set up chart
var chart = setUpChart();
var dailyReturnChart = setUpDailyReturnsChart();

// obtain references to key UI elements
var tickerElement = document.getElementById('ticker');
var targetPriceElement = document.getElementById('targetPrice');
var daysElement = document.getElementById('days');
var probElement = document.getElementById('chance');


// initialize the UI with initial values
dataStore.initialize(TICKER, DAYS, function(error, initialState) {

    if (error) {
        console.error(error);
        updateDataStatus('error');
        return;
    }

    updateDataStatus('OK');

    data = initialState;
    analysis = utils.analyze(data.currentPrice, data.targetPrice, data.days, data.priceHistory);
    updateProbability(probElement, analysis.probabilityOfOutcome);

    // update the target price
    targetPriceElement.value = Math.round(data.targetPrice);        

    drawChart(
        chart, 
        data.currentPrice, 
        data.targetPrice, 
        analysis.priceDistributionHV, 
        analysis.priceDistributionIV, 
        analysis.expectedMoveHV, 
        analysis.expectedMoveIV
    );

    drawDailyReturnsHistory(dailyReturnChart, 2, 2);
});

// when user changes ticker, retrieve/download current and historical pricing data
// recalculate probabilities
// update chart
tickerElement.addEventListener('change', function(event) {
    event.preventDefault();
    
    // capture the new ticker input
    var newTicker = tickerElement.value;

    dataStore.retrieve(newTicker, 'priceHistory', function(priceHistoryError, priceHistoryData) {

        if (priceHistoryError) {
            console.error(priceHistoryError);
            updateDataStatus('error');
            return;
        }

        updateDataStatus('OK');

        // cache updated raw data and input        
        data.currentPrice = priceHistoryData[0].close;
        data.ticker = newTicker;
        data.priceHistory = priceHistoryData;

        var newTargetPrice = Math.round(utils.updateTargetPrice(data.currentPrice, INITIAL_TARGET_RETURN));
        targetPriceElement.value = newTargetPrice;
        data.targetPrice = newTargetPrice;

        // update and cache analysis
        analysis = utils.analyze(data.currentPrice, data.targetPrice, data.days, data.priceHistory);

        updateProbability(probElement, analysis.probabilityOfOutcome);

        // update chart
        drawChart(
            chart, 
            data.currentPrice, 
            data.targetPrice, 
            analysis.priceDistributionHV, 
            analysis.priceDistributionIV, 
            analysis.expectedMoveHV, 
            analysis.expectedMoveIV
        );     

        drawDailyReturnsHistory(dailyReturnChart, 2, 2);
    });    
});

// when user changes target price, update analysis and chart
targetPriceElement.addEventListener('input', function(event) {

    // cache the new target price
    data.targetPrice = +targetPriceElement.value;

    // update and cache analysis
    analysis = utils.analyze(data.currentPrice, data.targetPrice, data.days, data.priceHistory);

    updateProbability(probElement, analysis.probabilityOfOutcome);

    drawChart(
        chart, 
        data.currentPrice, 
        data.targetPrice, 
        analysis.priceDistributionHV, 
        analysis.priceDistributionIV, 
        analysis.expectedMoveHV, 
        analysis.expectedMoveIV
    );
});

// when user changes days, update analysis and chart
daysElement.addEventListener('input', function(event) {

    // cache the new days input
    data.days = +daysElement.value;

    // update and cache analysis
    analysis = utils.analyze(data.currentPrice, data.targetPrice, data.days, data.priceHistory);

    updateProbability(probElement, analysis.probabilityOfOutcome);

    // update chart
    drawChart(
        chart, 
        data.currentPrice, 
        data.targetPrice, 
        analysis.priceDistributionHV, 
        analysis.priceDistributionIV, 
        analysis.expectedMoveHV, 
        analysis.expectedMoveIV
    );
});

/**
 * Initializes an SVG chart object for display and manipulation
 * @return  {object}    An object that includes a reference to a chart object as well its width and height
 */
function setUpChart() {
    var margin = { top: 20, right: 10, bottom: 20, left: 10 };
    var svg = d3.select('svg#bellCurve');
    var width = +svg.attr('width') - margin.left - margin.right;
    var height = +svg.attr('height') - margin.top - margin.bottom;
    
    var g = svg.append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
        .classed('blend-wrapper', true);

    return {
        chartSelection: g,
        width: width,
        height: height
    };
}

/**
 * Updates the chart object with graphical display data generated from provided inputs
 * @param {object} chart Reference to the chart object being drawn
 * @param {num} currentPrice Stock's current price
 * @param {number} targetPrice Desired price of the stock
 * @param {object} data_HV Description of distribution based on historical volatility
 * @param {object} data_IV Description of distribution based on implied volatility
 * @param [{number}] expectedMove_HV 1 standard deviation move based on historical volatility
 * @param [{number}] expectedMove_IV 1 standard deviation move based on implied volatility
 * @return  {void}
 */
function drawChart(chart, currentPrice, targetPrice, data_HV, data_IV, expectedMove_HV, expectedMove_IV) {

    var height = chart.height;
    var width = chart.width;
    chart = chart.chartSelection;

    // scales
    var xExtent_HV = d3.extent(data_HV, function(d) { return d.price; });
    var yExtent_HV = d3.extent(data_HV, function(d) { return d.probabilityDensity; });

    //var xExtent_IV = d3.extent(data_IV, function(d) { return d.price; });
    //var yExtent_IV = d3.extent(data_IV, function(d) { return d.probabilityDensity; });

    var xExtent = [];
    //xExtent[0] = Math.min(xExtent_HV[0], xExtent_IV[0]);
    xExtent[0] = xExtent_HV[0];
    //xExtent[1] = Math.max(xExtent_HV[1], xExtent_IV[1]);
    xExtent[1] = xExtent_HV[1];

    var yExtent = [];
    //yExtent[0] = Math.min(yExtent_HV[0], yExtent_IV[0]);
    yExtent[0] = yExtent_HV[0];
    //yExtent[1] = Math.max(yExtent_HV[1], yExtent_IV[1]);
    yExtent[1] = yExtent_HV[1];

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

    // each time we draw the chart, clear the DOM first
    chart.selectAll('.chart').remove();

    // draw the x axis
    chart.append("g")
        .classed('chart', true)
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xScale))
        .select(".domain")
        .remove();

    /* draw the y axis
    chart.append("g")
        .classed('chart', true)
        .call(d3.axisLeft(yScale))
        .append("text")
        .attr("fill", "#000")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", "0.71em")
        .attr("text-anchor", "end");*/

    // set the bottom of the area chart
    area.y0(yScale(yExtent[0]));

    var mixBlendMode = 'difference';
    var opacity = 0.4;

    // draw the area charts first
    var areaGroups = chart.append('g')
        .classed('area-charts chart', true)
        .style('isolation', 'isolate');

    areaGroups.append("path")
        .datum(data_HV)
        .attr("fill", "#a6cee3")
        .style('opacity', opacity)
        .style('mix-blend-mode', mixBlendMode)
        .attr("d", area);

    /*areaGroups.append("path")
        .datum(data_IV)
        .attr("fill", "#b2df8a")
        .style('opacity', opacity)
        .style('mix-blend-mode', mixBlendMode)
        .attr("d", area);*/

    // draw the lines
    /*chart.append("path")
        .datum(data_IV)
        .attr("fill", "none")
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 1.5)
        .attr('stroke', '#33a02c')
        .classed('chart', true)
        .attr("d", line);*/

    chart.append("path")
        .datum(data_HV)
        .attr("fill", "none")
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 1.5)
        .attr('stroke', '#1f78b4')
        .classed('chart', true)
        .attr("d", line);

    // draw vertical line at current price
    chart.append('line')
        .attr('x1', xScale(currentPrice))
        .attr('x2', xScale(currentPrice))
        .attr('y1', yScale(yExtent[0]))
        .attr('y2', yScale(yExtent[1]))
        .attr('stroke-width', 1)
        .attr('stroke', 'red')
        .classed('chart', true)
        .attr('fill', 'none');

    // draw vertical line at target price
    chart.append('line')
        .attr('x1', xScale(targetPrice))
        .attr('x2', xScale(targetPrice))
        .attr('y1', yScale(yExtent[0]))
        .attr('y2', yScale(yExtent[1]))
        .attr('stroke-width', 1)
        .attr('stroke', 'purple')
        .classed('chart', true)
        .attr('fill', 'none');
  
    // draw the expected move lines
    expectedMove_HV.forEach(function(value, index) {
        chart.append('line')
            .attr('x1', xScale(value))
            .attr('x2', xScale(value))
            .attr('y1', yScale(yExtent[0]))
            .attr('y2', yScale(yExtent[1]))
            .classed('chart', true)
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '6, 4')
            .attr('stroke', function() {
                //if (index < 2) return '#33a02c';
                return '#1f78b4';
            })
            .attr('fill', 'none');
    });
}

/**
 * Updates the UI with the new probability of achieving the desired outcome
 * @param   {object}    element Reference to the HTMLElement containing the probability output
 * @param   {number}    probability Probability of achieving the desired outcome
 * @return  {void}
 */
function updateProbability(element, probability) {
    element.textContent = (probability * 100).toFixed(1).concat('%');
}

/**
 * Sets up the daily return history chart
 */
function setUpDailyReturnsChart() {
    var margin = { top: 20, right: 10, bottom: 20, left: 10 };
    var svg = d3.select('svg#dailyReturns');
    var width = +svg.attr('width') - margin.left - margin.right;
    var height = +svg.attr('height') - margin.top - margin.bottom;
    
    var g = svg.append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
        .classed('blend-wrapper', true);

    return {
        chartSelection: g,
        width: width,
        height: height
    };
}

/**
 * Draws the daily return history chart
 */
function drawDailyReturnsHistory(chart, expectedReturn, returnHistory) {
    console.log('Drawing daily return chart');

    var height = chart.height;
    var width = chart.width;
    chart = chart.chartSelection;
}

/**
 * Updates UI elements to let user know whether the data was downloaded successfully
 * @param   {string} status Whether the data downloaded successfully. Either 'error' or 'ok'
 * @return  {void}
 */
function updateDataStatus(status) {

    var dataStatusIndicator = document.getElementById('dataStatus');
    var dataStatusText = document.getElementById('dataStatusText');

    if (status.toLowerCase() == 'ok') {
        dataStatusIndicator.className = 'dataState indicator statusOK';
        dataStatusText.textContent = 'OK';
    } else {        
        dataStatusIndicator.className = 'dataState indicator statusError';
        dataStatusText.textContent = 'Error';
    }
}
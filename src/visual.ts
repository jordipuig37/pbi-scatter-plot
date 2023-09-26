"use strict";
import "./../style/visual.less";

import powerbiVisualsApi from "powerbi-visuals-api";
import powerbi = powerbiVisualsApi;
import PrimitiveValue = powerbi.PrimitiveValue;
import ISelectionId = powerbi.visuals.ISelectionId;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISandboxExtendedColorPalette = powerbi.extensibility.ISandboxExtendedColorPalette;
import ISelectionManager = powerbi.extensibility.ISelectionManager;

import {
    select as d3Select
} from "d3-selection";
import {
    scaleLinear,
    scaleBand
} from "d3-scale";

import { axisBottom } from "d3-axis";
import { axisLeft } from "d3-axis";


type Selection<T1, T2 = T1> = d3.Selection<any, T1, any, T2>;
import ScaleLinear = d3.ScaleLinear;


import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;

import { VisualFormattingSettingsModel } from "./settings";

/** TODO list
[x] Add boilerplate from barchart or something
[x] define data interface
[x] define data transformation / parsing function
    [ ] Validate
    [ ] Improve
[ ] Choose which option setting are relevant
[ ] Define D3 logic to plot the chart
*/


/**
 * Get max function
*/
function getMax(array: Array<PrimitiveValue>) {
    let max: PrimitiveValue = array[0];
    for (let i = 0, len = array.length; i < len; i++) {
        if (array[i] > max) {
            max = array[i]
        }
    }
    return max;
}

function getMin(array: Array<PrimitiveValue>) {
    let max: PrimitiveValue = array[0];
    for (let i = 0, len = array.length; i < len; i++) {
        if (array[i] < max) {
            max = array[i]
        }
    }
    return max;
}


/**
 * Interface for ScatterPlot viewmodel.
 *
 * @interface
 * @property {DataPoint[]} dataPoints - Set of data points the visual will render.
 * @property {number} dataMax                 - Maximum data value in the set of data points.
 */
interface ScatterPlotViewModel {
    dataPoints: DataPoint[];
    xMax: number;
    xMin: number;
    yMax: number;
    yMin: number;
    settings: ScatterPlottSettings;
}

/**
 * Interface for ScatterPlot data points.
 *
 * @interface
 * @property {number} value             - Data value for point.
 * @property {string} category          - Corresponding category of data value.
 * @property {string} color             - Color corresponding to data point.
 * @property {ISelectionId} selectionId - Id assigned to data point for cross filtering
 *                                        and visual interaction.
 */
interface DataPoint {
    xValue: number;
    yValue: number;
    color: string;
}

/**
 * Interface for ScatterPlot settings.
 *
 * @interface
 * @property {{show:boolean}} enableAxis - Object property that allows axis to be enabled.
 * @property {{generalView.opacity:number}} Bars Opacity - Controls opacity of plotted bars, values range between 10 (almost transparent) to 100 (fully opaque, default)
 * @property {{generalView.showHelpLink:boolean}} Show Help Button - When TRUE, the plot displays a button which launch a link to documentation.
 */
interface ScatterPlottSettings {
    enableAxis: {
        show: boolean;
        fill: string;
    };

    generalView: {
        opacity: number;
        showHelpLink: boolean;
        helpLinkColor: string;
    };

    averageLine: {
        show: boolean;
        displayName: string;
        fill: string;
        showDataLabel: boolean;
    };
}

/**
 * Function that converts queried data into a view model that will be used by the visual.
 *
 * @function
 * @param {VisualUpdateOptions} options - Contains references to the size of the container
 *                                        and the dataView which contains all the data
 *                                        the visual had queried.
 * @param {IVisualHost} host            - Contains references to the host which contains services
 */
function visualTransform(options: VisualUpdateOptions, host: IVisualHost): ScatterPlotViewModel {
    let dataViews = options.dataViews;
    let viewModel: ScatterPlotViewModel = {
        dataPoints: [{xValue: 5, yValue: 3, color:'black'}, {xValue: 10, yValue: 3, color:'black'}],
        xMax: 10,
        xMin: 0,
        yMax: 10,
        yMin: 0,
        settings: <ScatterPlottSettings>{}
    };

    if (!dataViews // TODO: check this for empty viz considering X and Y
        || !dataViews[0]
        || !dataViews[0].table
        || !dataViews[0].table.columns
        || !dataViews[0].table.rows
    ) {
        return viewModel;
    }

    // Unpack data
    let table = dataViews[0].table;
    let columns = table.columns;
    let rows = table.rows;
    let xCol: Array<PrimitiveValue> = rows.map((row) => row[0]);
    let yCol: Array<PrimitiveValue> = rows.map((row) => row[1]);

    let xMax = <number>getMax(xCol);
    let xMin = <number>getMin(xCol);
    let yMax = <number>getMax(yCol);
    let yMin = <number>getMin(yCol);

    let scatterSettings = null;
    let scatterDataPoints: DataPoint[] = [];

    for (let i = 0, len = rows.length; i < len; i++) {
        let color = 'black'; // TODO: Improve to color by category (category.values[i])

        scatterDataPoints.push({
            xValue: <number>rows[i][0],
            yValue: <number>rows[i][1],
            color: color
        });
    }

    return {
        dataPoints: scatterDataPoints,
        xMax: xMax, xMin: xMin,
        yMax: yMax, yMin: yMin,
        settings: scatterSettings,
    };
}


/** *** *** *** *** *** *** *** *** *** *** *** *** *** *** *** *** *** *** **/
export class Visual implements IVisual {
    private svg: Selection<any>;
    private host: IVisualHost;
    private pointContainer: Selection<SVGElement>;
    private xAxis: Selection<SVGElement>;
    private xAxisLabel: Selection<SVGElement>;
    private yAxis: Selection<SVGElement>;
    private yAxisLabel: Selection<SVGElement>;
    private scatterDataPoints: DataPoint[];
    private scatterPlottSettings: ScatterPlottSettings;

    static Config = {
        xScalePadding: 0.1,
        solidOpacity: 1,
        transparentOpacity: 0.4,
        margins: {
            top: 0,
            right: 0,
            bottom: 25,
            left: 30,
        },
        xAxisFontMultiplier: 0.04,
        pointSize: 200
    };
// --------------------------------
    private target: HTMLElement;

    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;

    constructor(options: VisualConstructorOptions) {
        console.log('Visual constructor', options);
        this.formattingSettingsService = new FormattingSettingsService();
        this.target = options.element;
        this.host = options.host;
        this.svg = d3Select(options.element)
            .append('svg')
            .classed('scatterPlot', true);
        
        this.pointContainer = this.svg
            .append('g')
            .classed('pointContainer', true);
        
        this.xAxis = this.svg
            .append('g')
            .classed('xAxis', true);
            
        this.yAxis = this.svg
            .append('g')
            .classed('xAxis', true);
            
        this.xAxisLabel = this.svg
            .append('text')
            .classed('xAxisLabel', true);
            
        this.yAxisLabel = this.svg
            .append('text')
            .classed('xAxisLasbel', true);
    }
        
    public update(options: VisualUpdateOptions) {
        let viewModel: ScatterPlotViewModel = visualTransform(options, this.host);
        let xMax = viewModel.xMax;
        let xMin = viewModel.xMin;
        let yMax = viewModel.yMax;
        let yMin = viewModel.yMin;

        let width = options.viewport.width;
        let height = options.viewport.height;
        this.svg
            .attr('width', width)
            .attr('height', height)


        this.scatterDataPoints = viewModel.dataPoints;
        this.pointContainer.selectAll('circle')
            .data(this.scatterDataPoints)
            .join('circle')
            .attr('cx', (d) => ((d.xValue - xMin) / xMax) * width)
            .attr('cy', (d) => ((d.yValue - yMin) / yMax) * height)
            .attr('r', 20)
            .attr('fill', (d) => d.color);
    }
}
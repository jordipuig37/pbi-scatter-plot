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
    event as d3Event,
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
const getEvent = () => require("d3-selection").event;


import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;

import { VisualFormattingSettingsModel } from "./settings";

/** TODO list
[ ] Add boilerplate from barchart or something
[ ] define data interface
[ ] define data transformation / parsing function

*/

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
    yMax: number;
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
    xValue: PrimitiveValue;
    yValue: PrimitiveValue;
    category: string;
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
        dataPoints: [],
        xMax: 0,
        yMax: 0,
        settings: <ScatterPlottSettings>{}
    };

    if (!dataViews
        || !dataViews[0]
        || !dataViews[0].categorical
        || !dataViews[0].categorical.categories
        || !dataViews[0].categorical.categories[0].source
        || !dataViews[0].categorical.values
    ) {
        return viewModel;
    }

    let categorical = dataViews[0].categorical;
    let category = categorical.categories[0];
    let dataValue = categorical.values[0];

    let scatterDataPoints: DataPoint[] = [];
    let dataMax: number;

    let colorPalette: ISandboxExtendedColorPalette = host.colorPalette;
    let objects = dataViews[0].metadata.objects;

    const strokeColor: string = getColumnStrokeColor(colorPalette);

    let scatterPlottSettings: ScatterPlottSettings = {
        enableAxis: {
            show: getValue<boolean>(objects, 'enableAxis', 'show', defaultSettings.enableAxis.show),
            fill: getAxisTextFillColor(objects, colorPalette, defaultSettings.enableAxis.fill),
        },
        generalView: {
            opacity: getValue<number>(objects, 'generalView', 'opacity', defaultSettings.generalView.opacity),
            showHelpLink: getValue<boolean>(objects, 'generalView', 'showHelpLink', defaultSettings.generalView.showHelpLink),
            helpLinkColor: strokeColor,
        },
        averageLine: {
            show: getValue<boolean>(objects, 'averageLine', 'show', defaultSettings.averageLine.show),
            displayName: getValue<string>(objects, 'averageLine', 'displayName', defaultSettings.averageLine.displayName),
            fill: getValue<string>(objects, 'averageLine', 'fill', defaultSettings.averageLine.fill),
            showDataLabel: getValue<boolean>(objects, 'averageLine', 'showDataLabel', defaultSettings.averageLine.showDataLabel),
        },
    };

    const strokeWidth: number = getColumnStrokeWidth(colorPalette.isHighContrast);

    for (let i = 0, len = Math.max(category.values.length, dataValue.values.length); i < len; i++) {
        ...

        barChartDataPoints.push({
            ...
        });
    }

    dataMax = <number>dataValue.maxLocal;

    return {
        dataPoints: barChartDataPoints,
        dataMax: dataMax,
        settings: barChartSettings,
    };
}







/** *** *** *** *** *** *** *** *** *** *** *** *** *** *** *** *** *** *** **/
export class Visual implements IVisual {
    private svg: Selection<any>;
    private host: IVisualHost;
    private plotContainer: Selection<SVGElement>;
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
        
        this.plotContainer = this.svg
        .append('g')
        .classed('plotContainer', true);
        
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
            .classed('xAxisLabel', true);
        }
        
    public update(options: VisualUpdateOptions) {
        let viewModel: ScatterPlotViewModel = visualTransform(options, this.host);
        let settings = this.scatterPlottSettings = viewModel.settings;

        this.scatterDataPoints = viewModel.dataPoints;
    }

    /**
     * Returns properties pane formatting model content hierarchies, properties and latest formatting values, Then populate properties pane.
     * This method is called once every time we open properties pane or when the user edit any format property. 
     */
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
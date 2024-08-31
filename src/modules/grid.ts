import * as d3 from "d3";

type Area = {
    width: number,
    height: number
}

type Margin = {
    top: number,
    bottom: number,
    left: number,
    right: number
}

type Point2 = {
    x: number,
    y: number
}


/**
 * The PlotWindow is the region of the Graph which contains the plot.
 * It uses its own internal (unit) coordinate system which is independent of the containing element.
 */
interface PlotWindow {
    unitHeight(): number
    unitWidth(): number
    unitRangeX(): Array<number>
    unitRangeY(): Array<number>
    height(): number
    width(): number
    resolution(): number
}


// TODO: We could add alternative methods for sizing the plot/graph such as FlexiblePlotWindow which also resizes the
//       containing graph when the plot area is changed. We have no use case for this at the moment but could consider
//       it if we wanted more advanced graphing capabilities.
class FixedSizePlotWindow implements PlotWindow {
    _area: Area
    _bottomLeft: Point2 // Unit coordinates
    _resolution: number // The number of pixel per unit-length of the plot

    constructor(area: Area, bottomLeft: Point2,  resolution: number) {
        this._area = area
        this._resolution = resolution
        this._bottomLeft = bottomLeft
    }

    /** The number of plot units shown vertically. */
    public unitHeight(): number {
        return this._area.height / this._resolution
    }

    /** The number of plot units shown horizontally. */
    public unitWidth(): number {
        return this._area.width / this._resolution
    }

    /** The height of the plot in pixels. */
    public height(): number {
        return this._area.height
    }

    /** The width of the plot in pixels. */
    public width(): number {
        return this._area.width
    }

    public unitRangeX(): [number, number] {
        let min = this._bottomLeft.x
        let max = this._bottomLeft.x + this._area.width / this._resolution
        return [min, max]
    }

    public unitRangeY():  [number, number] {
        let min = this._bottomLeft.y
        let max = this._bottomLeft.y + this._area.height / this._resolution
        return [min, max]
    }

    public resolution(): number {
        return this._resolution
    }
}


type GraphConfig = {
    width: number,
    height: number,
    margin: Margin,
    plot: PlotWindow
}


type Graph = GraphConfig & {
    svg: SVGSVGElement
    /**
     * Transform the coordinates of a point within the plot area to the pixel location on the Graph.
     *
     * @param point The coordinates of a point in plot-coordinates
     * @return      The pixel location of this point on the SVG
     */
    toPixelCoords: (point: Point2) => Point2

    /**
     * Transform a pixel location on the Graph to coordinates within the plot area.
     *
     * @param point The pixel location of this point on the SVG
     * @return      The coordinates of a point in plot-coordinates
     */
    fromPixelCoords: (point: Point2) => Point2
}


/**
 * Calculate the dimensions of the plot within the graph
 *
 * @param graphDimensions
 * @param margin
 */
function plotArea(graphDimensions: Area, margin: Margin): Area {
    return {
        width: graphDimensions.width - margin.left - margin.right,
        height: graphDimensions.height - margin.top - margin.bottom
    }
}


/**
 * Increase the top/right margins so that the margins plus the plot cover the total graph area
 *
 * Typically called in conjunction with createPlotWindow.
 *
 * @param graphArea The total area of the graph
 * @param plot      The configuration for the plot region of a graph
 * @param margin    The initial bounding margins of the plot
 */
function recalculateMargins(graphArea: Area, plot: PlotWindow, margin: Margin): Margin {
    return {
        ...margin,
        top: graphArea.height - plot.height() - margin.bottom,
        right: graphArea.width - plot.width() - margin.left
    }
}


const DEFAULT_MARGIN: Margin = {
    top: 20,
    bottom: 20,
    left: 30,
    right: 30
}


/**
 * Create the configuration for a new graph.
 *
 * @param width      The width (in pixels) of the diagram
 * @param height     The height (in pixels) of the diagram
 * @param resolution The width (and height) of each unit in pixels
 * @param margin     The (minimum) internal margins of the diagram. The right / top margins are increased to allow
 *                   for an integer number of squares.
 */
function createGraphConfig(width: number, height: number, resolution: number, margin: Margin): GraphConfig {
    let graphDimensions = {width, height}
    let dimensions = plotArea(graphDimensions, margin)

    // Shrink the plot area to be an integer number of units - it looks better
    dimensions = {
        width: Math.trunc(dimensions.width / resolution) * resolution,
        height: Math.trunc(dimensions.height / resolution) * resolution
    }

    let bottomLeftCoords = {x: 0, y: 0}
    let plotWindow = new FixedSizePlotWindow(dimensions, bottomLeftCoords, resolution)

    // Grow the margins to offset the change in plot dimensions
    let newMargin = recalculateMargins(graphDimensions, plotWindow, margin)

    return {
        width,
        height,
        margin: newMargin,
        plot: plotWindow,
    }
}


function createGraph(width: number, height: number, resolution: number = 36, margin: Margin = DEFAULT_MARGIN): Graph {
    let config = createGraphConfig(width, height, resolution, margin)
    let svg = createSVG(config)

    return {
        ...config,
        svg,
        toPixelCoords(point: Point2) {
            return toPixelCoords(this, point)
        },
        fromPixelCoords(point: Point2) {
            return fromPixelCoords(this, point)
        }
    }
}


// A linear mapping from unit coordinates (the domain) to pixel coordinates for the xAxis
function xAxis(config: GraphConfig): d3.Axis<d3.NumberValue> {
    return d3.axisBottom(d3.scaleLinear()
        .domain(config.plot.unitRangeX())
        .range([config.margin.left, config.width - config.margin.right])
    ).ticks(config.plot.unitWidth())
}

// A linear mapping from unit coordinates (the domain) to pixel coordinates for the yAxis
function yAxis(config: GraphConfig): d3.Axis<d3.NumberValue> {
    return d3.axisLeft(d3.scaleLinear()
        .domain(config.plot.unitRangeY())
        .range([config.height - config.margin.bottom, config.margin.top])
    ).ticks(config.plot.unitHeight())
}


/**
 * Create a new SVG Element. It is not attached to any DOM element.
 */
function createSVG(config: GraphConfig): SVGSVGElement {
    const svg = d3.create("svg")
        .attr("width", config.width)
        .attr("height", config.height);

    // Add the x-axis.
    svg.append("g")
        .attr("transform", `translate(0,${config.height - config.margin.bottom})`)
        .call(xAxis(config))

    // Add the y-axis.
    svg.append("g")
        .attr("transform", `translate(${config.margin.left},0)`)
        .call(yAxis(config))

    // Add the y-gridlines
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0, ${config.height - config.margin.bottom})`)
        .call(xAxis(config)
            // A tick is usually defaults to 6px. We extend them the full height of the plot to create the grid-lines
            .tickSize(-config.plot.height())
            .tickFormat(() => "")
        )

    // Add the x-gridlines.
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(${config.margin.left}, 0)`)
        .call(yAxis(config)
            // A tick is usually defaults to 6px. We extend them the full width of the plot to create the grid-lines
            .tickSize(-config.plot.width())
            .tickFormat(() => "")
        )

    return svg.node()!
}

function toPixelCoords(context: Graph, point: Point2): Point2 {
    let px = context.margin.left + point.x * context.plot.resolution();
    let py = context.height - context.margin.bottom - point.y * context.plot.resolution();
    return {x: px, y: py}
}

function fromPixelCoords(context: Graph, point: Point2): Point2 {
    let ux = (point.x - context.margin.left) / context.plot.resolution();
    let uy = (-point.y + context.height - context.margin.bottom) / context.plot.resolution();
    return {x: ux, y: uy}
}

export {createGraph}

export type {
    Margin,
    Graph,
    PlotWindow,
    Area,
    Point2
}

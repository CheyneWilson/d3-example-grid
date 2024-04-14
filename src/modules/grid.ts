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
 * The Plot Config represents the plot region of the graph
 */
class PlotConfig {
    min: Point2        // The coordinates of the bottom left corner (in unit-coordinates)
    max: Point2        // The coordinates of the top right corner (in unit-coordinates)
    resolution: number // The number of pixel per unit-length of the plot

    constructor(min: Point2, max: Point2, resolution: number) {
        this.min = min
        this.max = max
        this.resolution = resolution
    }

    /** The unit height of the plot. */
    public unitHeight(): number {
        return this.max.y - this.min.y
    }

    /** The unit width of the plot. */
    public unitWidth(): number {
        return this.max.x - this.min.x
    }

    /** The height of the plot in pixels. */
    public height(): number {
        return this.unitHeight() * this.resolution
    }

    /** The width of the plot in pixels. */
    public width(): number {
        return this.unitWidth() * this.resolution
    }
}


type GraphConfig = {
    width: number,
    height: number,
    margin: Margin,
    plot: PlotConfig
}

type Graph = GraphConfig & {
    svg: SVGSVGElement
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
 * Generate the plot config (dimensions / coordinates)
 *
 * @param min            The coordinates of the bottom left corner of the plot (in units)
 * @param resolution     The number of pixels per unit length
 * @param plotDimensions The size of the plot area in pixel
 */
// TODO: We could add different functions for calculating these properties
//       E.g. take the in the centre-point to derive the min and max points
function createPlotConfig(min: Point2, resolution: number, plotDimensions: Area): PlotConfig {
    let x = min.x + Math.floor((plotDimensions.width) / resolution)
    let y = min.y + Math.floor((plotDimensions.height) / resolution)
    let max = {x, y}
    return new PlotConfig(min, max, resolution)
}

/**
 * Increase the top/right margins so that the margins plus the plot cover the total graph area
 *
 * Typically called in conjunction with createPlotConfig.
 *
 * @param graphArea The total area of the graph
 * @param plot      The configuration for the plot region of a graph
 * @param margin    The initial bounding margins of the plot
 */
// TODO: We could add alternative methods for sizing the plot/graph, such as expanding the graph or shrinking the plot
//       but we have no use case for them with the current use-cases.
function recalculateMargins(graphArea: Area, plot: PlotConfig, margin: Margin): Margin {
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
    let plot = plotArea(graphDimensions, margin)

    let bottomLeftCoords = {x: 0, y: 0}
    let plotConfig = createPlotConfig(bottomLeftCoords, resolution, plot)

    let newMargin = recalculateMargins(graphDimensions, plotConfig, margin)

    return {
        width,
        height,
        margin: newMargin,
        plot: plotConfig,
    }
}

function createGraph(width: number, height: number, resolution: number = 36, margin: Margin = DEFAULT_MARGIN): Graph {
    let config = createGraphConfig(width, height, resolution, margin)
    let svg = createSVG(config)

    return {
        ...config,
        svg
    }
}


// A linear mapping from unit coordinates (the domain) to pixel coordinates for the xAxis
function xAxis(config: GraphConfig): d3.Axis<d3.NumberValue> {
    return d3.axisBottom(d3.scaleLinear()
        .domain([config.plot.min.x, config.plot.max.x])
        .range([config.margin.left, config.width - config.margin.right])
    ).ticks(config.plot.unitWidth())
}

// A linear mapping from unit coordinates (the domain) to pixel coordinates for the yAxis
function yAxis(config: GraphConfig): d3.Axis<d3.NumberValue> {
    return d3.axisLeft(d3.scaleLinear()
        .domain([config.plot.min.y, config.plot.max.y])
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

/**
 * Transform a point from grid coordinates to pixel coordinates
 *
 * @param context
 * @param point the location of a point with grid coordinates
 * @return The pixel location of this point on the SVG
 */
function toPixelCoords(context: Graph, point: Point2): Point2 {
    let px = context.margin.left + point.x * context.plot.resolution;
    let py = context.height - context.margin.bottom - point.y * context.plot.resolution;
    return {x: px, y: py}
}

function fromPixelCoords(context: Graph, point: Point2): Point2 {
    let ux = (point.x - context.margin.left) / context.plot.resolution;
    let uy = (-point.y + context.height - context.margin.bottom  )/ context.plot.resolution;
    return {x: ux, y: uy}
}


export {
    toPixelCoords,
    fromPixelCoords,
    createGraph,
}

export type {
    Margin,
    Graph,
    Point2
}
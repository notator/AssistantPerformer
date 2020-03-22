
let
	_iVertical,
	_iBottomHoriz,
	_element,
	_topAsString,

	_setAlignment = function(alignment)
	{
		_element.setAttribute("transform", "translate(" + alignment.toString(10) + " " + _topAsString + ")");
	},

	// these arguments are in viewBox units, not pixels.
	_setCoordinates = function(alignment, top, bottom)
	{
		_topAsString = top.toString(10);

		let bottomReTop = (bottom - top).toString(10);

		_iVertical.setAttribute("y2", bottomReTop);
		_iBottomHoriz.setAttribute("y1", bottomReTop);
		_iBottomHoriz.setAttribute("y2", bottomReTop);

		_setAlignment(alignment);
	},

	_get_Element = function(viewBoxScale, isConductingTimer)
	{
		function getCoordinateVectors(viewBoxScale)
		{
			let x = [-13.9, -9.7, -5.7, -1.5, 0],
				y = [6, 10, 14],
				accH = (y[1] - y[0]) * (x[3] - x[1]) / (x[3] - x[0]);

			y.push(0); // top of I-beam
			y.push(y[1] - accH);
			y.push(y[1] + accH);
			y.sort((a, b) => a - b);

			x.push(-4); // I-beam left
			x.push(4); // I-beam right
			x.sort((a, b) => a - b);

			let rx = [], ry = [];
			x.forEach(a => rx.push(a *= viewBoxScale));
			y.forEach(a => ry.push(a *= viewBoxScale));

			return ({ x:rx, y:ry });
		}

		function getStyles(viewBoxScale)
		{
			const BLUE = "#5555FF";

			let strokeAndFillColor = "stroke:" + BLUE + ";fill:none",
				thickWidth = 1.5 * viewBoxScale,
				thickStyle = strokeAndFillColor + ";stroke-width:" + thickWidth.toString(10),
				thinWidth = 1 * viewBoxScale,
				thinStyle = strokeAndFillColor + ";stroke-width:" + thinWidth.toString(10);

			return ({ thin: thinStyle, thick: thickStyle });
		}

		function newIMarker(x, y, styles)
		{
			let iMarker = document.createElementNS("http://www.w3.org/2000/svg", "g"),
				iVertical = document.createElementNS("http://www.w3.org/2000/svg", "line"),
				iTopHoriz = document.createElementNS("http://www.w3.org/2000/svg", "line"),
				iBottomHoriz = document.createElementNS("http://www.w3.org/2000/svg", "line");

			iVertical.setAttribute("x1", x[5].toString(10));
			iVertical.setAttribute("x2", x[5].toString(10));
			iVertical.setAttribute("y1", y[0].toString(10));
			iVertical.setAttribute("y2", y[5].toString(10)); // is set again in _setCoordinates
			iVertical.setAttribute("style", styles.thin);

			iTopHoriz.setAttribute("x1", x[3].toString(10));
			iTopHoriz.setAttribute("x2", x[6].toString(10));
			iTopHoriz.setAttribute("y1", y[0].toString(10));
			iTopHoriz.setAttribute("y2", y[0].toString(10));
			iTopHoriz.setAttribute("style", styles.thin);

			iBottomHoriz.setAttribute("x1", x[3].toString(10));
			iBottomHoriz.setAttribute("x2", x[6].toString(10));
			iBottomHoriz.setAttribute("y1", y[5].toString(10)); // is set again in _setCoordinates
			iBottomHoriz.setAttribute("y2", y[5].toString(10)); // is set again in _setCoordinates
			iBottomHoriz.setAttribute("style", styles.thin);

			iMarker.appendChild(iVertical);
			iMarker.appendChild(iTopHoriz);
			iMarker.appendChild(iBottomHoriz);

			_iVertical = iVertical;
			_iBottomHoriz = iBottomHoriz;

			return iMarker;
		}
		function newCreepArrow(x, y, styles)
		{
			let creepArrow = document.createElementNS("http://www.w3.org/2000/svg", "g"),
				creepHoriz = document.createElementNS("http://www.w3.org/2000/svg", "path"),
				creepTip = document.createElementNS("http://www.w3.org/2000/svg", "path");

			creepHoriz.setAttribute("d", "M" + x[0] + " " + y[3] + " " + x[4] + " " + y[3]);
			creepHoriz.setAttribute("style", styles.thick);

			creepTip.setAttribute("d", "M" + x[2] + " " + y[1] + " " + x[4] + " " + y[3] + " " + x[2] + " " + y[5]);
			creepTip.setAttribute("style", styles.thin);

			creepArrow.appendChild(creepHoriz);
			creepArrow.appendChild(creepTip);

			return creepArrow;
		}

		let cv = getCoordinateVectors(viewBoxScale),
			styles = getStyles(viewBoxScale),
			element = document.createElementNS("http://www.w3.org/2000/svg", "g"),
			x = cv.x,
			y = cv.y;

		element.appendChild(newIMarker(x, y, styles)); // sets _iVertical and _iBottomHoriz

		if(isConductingTimer === false)
		{
			element.appendChild(newCreepArrow(x, y, styles));
		}

		_element = element;
	};

export class TimeMarker
{
	constructor(score, isConductingTimer)
	{
		let startMarker = score.getStartMarker(),
			cursor = score.getCursor(),
			regionSequence = score.getRegionSequence(),
			startRegionIndex = score.getStartRegionIndex(),
			endRegionIndex = score.getEndRegionIndex(),
			msPosDataArray = cursor.msPosDataArray,
			currentMsPosDataIndex = msPosDataArray.findIndex((a) => a.msPositionInScore === startMarker.msPositionInScore),
			msPosData = msPosDataArray[currentMsPosDataIndex],
			nextMsPosData = msPosDataArray[currentMsPosDataIndex + 1], // the final barline is in msPosDataArray, but regions can't start there.
			yCoordinates = msPosData.yCoordinates;


		_get_Element(cursor.viewBoxScale, isConductingTimer);

		// constants
		Object.defineProperty(this, "_systemChangedCallback", { value: cursor.systemChangedCallback, writable: false });
		Object.defineProperty(this, "_viewBoxScale", { value: cursor.viewBoxScale, writable: false });
		Object.defineProperty(this, "_regionSequence", { value: regionSequence, writable: false });
		Object.defineProperty(this, "_endRegionIndex", { value: endRegionIndex, writable: false });

		 // updated while running
		Object.defineProperty(this, "_smoothMsPositionInScore", { value: startMarker.msPositionInScore, writable: true });	
		Object.defineProperty(this, "_msPosData", { value: msPosData, writable: true });
		Object.defineProperty(this, "_nextMsPosData", { value: nextMsPosData, writable: true });
		Object.defineProperty(this, "_regionIndex", { value: startRegionIndex, writable: true });
		Object.defineProperty(this, "_msPosDataArray", { value: cursor.msPosDataArray, writable: true });
		Object.defineProperty(this, "_msPosDataIndex", { value: currentMsPosDataIndex, writable: true });
		Object.defineProperty(this, "_yCoordinates", { value: yCoordinates, writable: true });
		Object.defineProperty(this, "_alignment", { value: msPosData.alignment, writable: true });
		Object.defineProperty(this, "_totalPxIncrement", { value: 0, writable: true });

		_setCoordinates(msPosData.alignment, msPosData.yCoordinates.top, msPosData.yCoordinates.bottom);
	}

	getElement()
	{
		return _element;
	}

	getPixelsPerMs()
	{
		return this._msPosData.pixelsPerMs;
	}

	advance(smoothMsDurationInScore)
	{
		function moveElementTo(that, currentMsPosData, currentPreciseAlignment, nextAlignment, msIncrement)
		{
			that._totalPxIncrement += (msIncrement * currentMsPosData.pixelsPerMs);

			let pxDeltaToCome = nextAlignment - currentPreciseAlignment;
			// This 0.5 limit helps to improve the audio output by reducing the number of
			// times the display is updated, but it also means that the grey cursor jumps
			// 0.5 pixels ahead of the TimeMarker on reaching chords and rests, in both
			// conductTimer and conductCreep modes. The use of pxDeltaToCome ensures that
			// this problem is avoided in the final pixels before a chord or rest symbol
			// while creeping.
			if((that._isCreeping && pxDeltaToCome < 3) || (that._totalPxIncrement > 0.5))
			{
				let alignment = currentPreciseAlignment + that._totalPxIncrement;

				if(that._yCoordinates !== currentMsPosData.yCoordinates)
				{
					that._yCoordinates = currentMsPosData.yCoordinates;
					_setCoordinates(alignment, that._yCoordinates.top, that._yCoordinates.bottom);
					let yCoordinates = { top: that._yCoordinates.top / that._viewBoxScale, bottom: that._yCoordinates.bottom / that._viewBoxScale };
					that._systemChangedCallback(yCoordinates);
				}
				else
				{
					_setAlignment(alignment);
				}

				that._alignment = alignment;
				that._totalPxIncrement = 0;
			}
			//else
			//{
			//	console.log("Skipped a display update.");
			//}
		}

		// this._smoothMsPositionInScore is the accurate current msPosition wrt the start of the score (also between chords and rests).
		this._smoothMsPositionInScore += smoothMsDurationInScore;

		// this._nextMsPosData will be undefined when the TimeMarker has reached the final barline.
		if(this._nextMsPosData !== undefined && this._smoothMsPositionInScore >= this._nextMsPosData.msPositionInScore)
		{
			if(this._regionSequence[this._regionIndex].endMsPosInScore <= this._nextMsPosData.msPositionInScore)
			{
				if(this._regionIndex < this._endRegionIndex)
				{
					// move to the next region
					this._regionIndex++;
					this._smoothMsPositionInScore = this._regionSequence[this._regionIndex].startMsPosInScore;
					this._msPosData = this._msPosDataArray.find((a) => a.msPositionInScore === this._smoothMsPositionInScore);
					this._msPosDataIndex = this._msPosDataArray.findIndex((e) => e === this._msPosData);
					this._alignment = this._msPosData.alignment;

					// index + 1 should always work, because the final barline is in this._msPosDataArray, but regions can't start there.
					this._nextMsPosData = this._msPosDataArray[this._msPosDataIndex + 1];
					smoothMsDurationInScore = 0;
				}
			}
			else
			{
				// move to the next chord or rest in the region
				this._msPosDataIndex++;				
				this._msPosData = this._msPosDataArray[this._msPosDataIndex];
				this._alignment = this._msPosData.alignment;
				// index + 1 should always work at the end of regions.
				// it also works for the last midiObject in the score because the final barline is in this._msPosDataArray,
				// but this._nextMsPosData will be set to undefined when the TimeMarker reaches the final barline.
				this._nextMsPosData = this._msPosDataArray[this._msPosDataIndex + 1];
				smoothMsDurationInScore = 0;
			}
		}

		if(this._nextMsPosData !== undefined)
		{
			moveElementTo(this, this._msPosData, this._alignment, this._nextMsPosData.alignment, smoothMsDurationInScore);
		}
	}
}


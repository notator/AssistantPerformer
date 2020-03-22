
export class Cursor
{
	constructor(systemChangedCallback, viewBoxScale)
	{
		function newElement(viewBoxScale)
		{
			const GREY = "#999999";

			let element = document.createElementNS("http://www.w3.org/2000/svg", 'line');

			element.setAttribute("class", "cursorLine");
			element.setAttribute("style", "stroke:" + GREY + ";stroke-width:" + viewBoxScale.toString(10) + "px; visibility:hidden");
			// the following attributes are set properly in moveElementTo(...) (inside init(...))
			element.setAttribute("x1", "0");
			element.setAttribute("y1", "0");
			element.setAttribute("x2", "0");
			element.setAttribute("y2", "0");

			return element;
		}

		Object.defineProperty(this, "systemChangedCallback", { value: systemChangedCallback, writable: false });
		Object.defineProperty(this, "viewBoxScale", { value: viewBoxScale, writable: false });
		Object.defineProperty(this, "element", { value: newElement(viewBoxScale), writable: false });

		Object.defineProperty(this, "msPosDataArray", { value: undefined, writable: true }); // set in init()
		Object.defineProperty(this, "startMarkerMsPosInScore", { value: -1, writable: true }); // set in init()
		Object.defineProperty(this, "endMarkerMsPosInScore", { value: -1, writable: true }); // set in init()
		Object.defineProperty(this, "yCoordinates", { value: { top: -1, bottom: -1 }, writable: true }); // set in moveElementTo() in init()		
	}

	set(systems, startMarkerMsPositionInScore, endMarkerMsPositionInScore, trackIsOnArray)
	{
		// Returns an array containing an msPosData object for every distinct msPositionInScore.
		// An msPosData object contains the following fields:
		//	.msPositionInScore
		//	.alignmentX
		//	.yCoordinates
		//	.pixelsPerMs
		// The msPosData objects are sorted in order of .msPositionInScore.
		// The last entry is an msPosData object for the final barline.
		function getScoreMsPosDataArray(systems, viewBoxScale, trackIsOnArray)
		{
			// This array, containing one msPosData object per system, is needed
			// for the case that when tracks are disabled, there are no midiObjects
			// at the beginning of the system.
			function getDefaultSystemStartMsPosDataArray(systems, viewBoxScale)
			{
				let msPosDataPerSystem = [];

				for(let system of systems)
				{
					let line = system.startMarker.line,
						yCoordinates = {},
						leftmostTimeObject = system.staves[0].voices[0].timeObjects[0], 
						// The pixelsPerMs field is set properly later.
						msPosData = { msPositionInScore: leftmostTimeObject.msPositionInScore, alignment: leftmostTimeObject.alignment * viewBoxScale, pixelsPerMs: 0, yCoordinates: yCoordinates };

					yCoordinates.top = line.y1.baseVal.value;
					yCoordinates.bottom = line.y2.baseVal.value;

					for(let staff of system.staves)
					{
						for(let voice of staff.voices)
						{
							if(voice.timeObjects[0].alignment < leftmostTimeObject.alignment)
							{
								leftmostTimeObject = voice.timeObjects[0];
								// The pixelsPerMs field is set properly later.
								msPosData = { msPositionInScore: leftmostTimeObject.msPositionInScore, alignment: leftmostTimeObject.alignment * viewBoxScale, pixelsPerMs: 0, yCoordinates: yCoordinates };
							}
						}
					}
					msPosDataPerSystem.push(msPosData);
				}

				return msPosDataPerSystem;
			}

			function getSystemMsPosDataArray(system, viewBoxScale, trackIsOnArray)
			{
				function setPixelsPerMs(systemMsPosDataArray)
				{
					let nMsPositions = systemMsPosDataArray.length - 1; // systemMsPosDataArray contains an entry for the final barline
					for(let i = 0; i < nMsPositions; ++i)
					{
						let msPosData = systemMsPosDataArray[i],
							nextMsPosData = systemMsPosDataArray[i + 1];

						msPosData.pixelsPerMs = (nextMsPosData.alignment - msPosData.alignment) / (nextMsPosData.msPositionInScore - msPosData.msPositionInScore);
					}
				}

				let systemMsPosDataArray = [],
					nStaves = system.staves.length,
					line = system.startMarker.line,
					yCoordinates = {};

				yCoordinates.top = line.y1.baseVal.value;
				yCoordinates.bottom = line.y2.baseVal.value;

				let trackIndex = 0;
				for(let staffIndex = 0; staffIndex < nStaves; ++staffIndex)
				{
					let staff = system.staves[staffIndex], nVoices = staff.voices.length;
					for(let voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
					{
						if(trackIsOnArray[trackIndex++] === true)
						{
							if(staff.voices[voiceIndex].timeObjects === undefined)
							{
								// this can happen if the voice is an InputVoice, and the input device is not selected.
								continue;
							}
							let timeObjects = staff.voices[voiceIndex].timeObjects,
								nTimeObjects = timeObjects.length; // timeObjects includes the final barline in the voice

							if(staffIndex === 0 && voiceIndex === 0)
							{
								for(let ti = 0; ti < nTimeObjects; ++ti)
								{
									let tObj = timeObjects[ti], msPos = tObj.msPositionInScore,
										// pixelsPerMs is set properly later in this functon
										msPosData = { msPositionInScore: msPos, alignment: tObj.alignment * viewBoxScale, pixelsPerMs: 0, yCoordinates: yCoordinates };

									systemMsPosDataArray.push(msPosData);
								}
							}
							else
							{
								for(let ti = nTimeObjects - 1; ti >= 0; --ti)
								{
									let tObj = timeObjects[ti], msPos = tObj.msPositionInScore;
									if(systemMsPosDataArray.find((e) => e.msPositionInScore === msPos) === undefined)
									{
										// pixelsPerMs is set properly later in this functon
										let msPosData = { msPositionInScore: msPos, alignment: tObj.alignment * viewBoxScale, pixelsPerMs: 0, yCoordinates: yCoordinates };
										systemMsPosDataArray.push(msPosData);
									}
								}
							}
						}
					}
				}

				systemMsPosDataArray.sort((a, b) => a.msPositionInScore - b.msPositionInScore);
				setPixelsPerMs(systemMsPosDataArray);

				return systemMsPosDataArray;
			}

			let defaultSystemStartMsPosData = getDefaultSystemStartMsPosDataArray(systems, viewBoxScale); 
			let msPosDataArray = [];
			let nSystems = systems.length;
			for(let i = 0; i < nSystems; ++i)
			{
				let system = systems[i];
				// The last entry in systemMsPosDataArray is an msPosData object for the final barline.
				let systemMsPosDataArray = getSystemMsPosDataArray(system, viewBoxScale, trackIsOnArray);
				// If there was no msPosData object at the start of the system, insert the default value.
				if(systemMsPosDataArray[0].alignment > defaultSystemStartMsPosData[i].alignment)
				{
					systemMsPosDataArray.splice(0, 0, defaultSystemStartMsPosData[i]);
				}
				// if this is not the last system, delete the msPosData object of the right barline.
				if(i < nSystems - 1)
				{
					systemMsPosDataArray.length = systemMsPosDataArray.length - 1;
				}
				msPosDataArray = msPosDataArray.concat(systemMsPosDataArray);
			}
			return msPosDataArray;
		}

		// The last entry is an msPosData object for the final barline.
		this.msPosDataArray = getScoreMsPosDataArray(systems, this.viewBoxScale, trackIsOnArray);

		this.startMarkerMsPosInScore = startMarkerMsPositionInScore;
		this.endMarkerMsPosInScore = endMarkerMsPositionInScore;

		this.moveElementTo(startMarkerMsPositionInScore); // sets yCoordinates if necessary

		this.setVisible(true);
	}

	// use running index here if possible...
	moveElementTo(msPositionInScore)
	{
		let msPosData = this.msPosDataArray.find((e) => e.msPositionInScore === msPositionInScore);
		if(msPosData !== undefined)
		{
			if(msPosData.yCoordinates !== this.yCoordinates)
			{
				this.yCoordinates = msPosData.yCoordinates;
				this.element.setAttribute("y1", this.yCoordinates.top.toString(10));
				this.element.setAttribute("y2", this.yCoordinates.bottom.toString(10));
				let yCoordinates = { top: this.yCoordinates.top / this.viewBoxScale, bottom: this.yCoordinates.bottom / this.viewBoxScale };
				this.systemChangedCallback(yCoordinates);
			}
			this.element.setAttribute("x1", msPosData.alignment.toString(10));
			this.element.setAttribute("x2", msPosData.alignment.toString(10));
		}
	}

	setVisible(setToVisible)
	{
		if(setToVisible)
		{
			this.element.style.visibility = 'visible';
		}
		else
		{
			this.element.style.visibility = 'hidden';
		}
	}
}



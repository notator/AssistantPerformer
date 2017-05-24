/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/MidiObject.js
 *  Public interface:
 *      MidiChord(scoreMidiElem) // MidiChord constructor
 *      MidiRest(scoreMidiElem) // MidiRest constructor
 */

_AP.namespace('_AP.midiChord');

_AP.midiObject = (function()
{
    "use strict";
    // begin var
    var
    Message = _AP.message.Message,
    SysExMessage = _AP.message.SysExMessage,
    Moment = _AP.moment.Moment, // constructor

    // The rate (milliseconds) at which slider messages are sent.
    SLIDER_MILLISECONDS = 100,

    defineMidiObjectProperties = function(that, scoreMidiElem, systemIndex)
    {
        // moments is an ordered array of Moment objects.
        // A Moment is a list of logically synchronous Messages.
        // The msDurationInScore and msPositionInScore properties are not changed by the global speed option!
        // These values are used, but not changed, either when moving Markers about or during performances.)
        Object.defineProperty(that, "moments", { value: that._getMoments(scoreMidiElem, systemIndex), writable: true });
        Object.defineProperty(that, "msDurationInScore", { value: that.msDurationInScore, writable: false });
        //Object.defineProperty(that, "msPositionInScore", { value: 0, writable: true });

        // used at runtime
        Object.defineProperty(that, "currentMoment", { value: that.moments[0], writable: true });
        Object.defineProperty(that, "_currentMomentIndex", { value: -1, writable: true });
    },

    // public MidiChord constructor
    // A MidiChord contains all the midi messages required for playing an (ornamented) chord. 
    MidiChord = function(scoreMidiElem, systemIndex)
    {
        if(!(this instanceof MidiChord))
        {
            return new MidiChord(scoreMidiElem, systemIndex);
        }

        defineMidiObjectProperties(this, scoreMidiElem, systemIndex);

        return this;
    },

    // public MidiRest constructor
    // A MidiRest is functionally identical to a MidiChord.
    // The only way to distinguish between the two is by using the instanceof operator.
    MidiRest = function(scoreMidiElem, systemIndex)
    {
        if(!(this instanceof MidiRest))
        {
            return new MidiRest(scoreMidiElem, systemIndex);
        }

        defineMidiObjectProperties(this, scoreMidiElem, systemIndex);

        return this;
    },

    publicMidiObjectAPI =
    {
        // public MidiChord constructor
        // A MidiChord contains a private array of Moments containing all
        // the midi messages required for playing an (ornamented) chord.
        // A Moment is a collection of logically synchronous MIDI Messages.
        MidiChord: MidiChord,
        // public MidiRest constructor
        // A MidiRest is functionally identical to a MidiChord.
        // The only way to distinguish between the two is by using the instanceof operator.
        MidiRest: MidiRest
    };
    // end var

    // returns strongly classed Moment objects containing strongly classed Message objects
    MidiChord.prototype._getMoments = function(scoreMidiElem, systemIndex)
    {
        var i, moments, momentMoments = [], envsMoments = [], msDuration = 0,
            scoreMidiChild, scoreMidiChildren = scoreMidiElem.children;

        function getMsg(bytes)
        {
            var msg;

            switch(bytes.length)
            {
                case 1:
                    msg = new Message(bytes[0]);
                    break;
                case 2:
                    msg = new Message(bytes[0], bytes[1]);
                    break;
                case 3:
                    msg = new Message(bytes[0], bytes[1], bytes[2]);
                    break;
                default:
                    msg = new SysExMessage(bytes);
                    break;
            }
            return msg;
        }

        // returns the moments in the momentsElem, with all the msgs
        // converted to Uint8 arrays.
        function getMomentsMoments(momentsElem)
        {
            var i, msPos = 0, momentsMoment, momentsMoments = [], msChildren = momentsElem.children;

            function getMsgs(msgsElem)
            {
                var i, j, msgsChildren = msgsElem.children,
                    msgStr, byteStrs, byteStr, bytes = [], byte, msgs = [], msg;

                for(i = 0; i < msgsChildren.length; ++i)
                {
                    if(msgsChildren[i].nodeName === "msg")
                    {
                        msgStr = msgsChildren[i].getAttribute("m");
                        byteStrs = msgStr.split(' ');
                        bytes.length = 0;
                        for(j = 0; j < byteStrs.length; ++j)
                        {
                            byteStr = byteStrs[j];
                            if(byteStr.indexOf("0x") >= 0)
                            {
                                byte = parseInt(byteStr, 16);
                            }
                            else
                            {
                                byte = parseInt(byteStr, 10);
                            }
                            bytes.push(byte);
                        }
                        msg = getMsg(bytes);
                        msgs.push(msg);
                    }
                }
                return msgs;
            }

            function getMomentsMoment(momentElem, msPos)
            {
                var i, momentChildren = momentElem.children,
                    momentsMoment = {};

                momentsMoment.msPositionInChord = msPos;
                momentsMoment.msDuration = parseInt(momentElem.getAttribute("msDuration"), 10);
                momentsMoment.noteOffMsgs = [];
                momentsMoment.switchesMsgs = [];
                momentsMoment.noteOnMsgs = [];

                for(i = 0; i < momentChildren.length; ++i)
                {
                    if(momentChildren[i].nodeName === "noteOffs")
                    {
                        momentsMoment.noteOffMsgs = getMsgs(momentChildren[i]);
                    }
                    if(momentChildren[i].nodeName === "switches")
                    {
                        momentsMoment.switchesMsgs = getMsgs(momentChildren[i]);
                    }
                    if(momentChildren[i].nodeName === "noteOns")
                    {
                        momentsMoment.noteOnMsgs = getMsgs(momentChildren[i]);
                    }
                }
                return momentsMoment;
            }

            for(i = 0; i < msChildren.length; ++i)
            {
                if(msChildren[i].nodeName === "moment")
                {
                    momentsMoment = getMomentsMoment(msChildren[i], msPos);
                    msPos += momentsMoment.msDuration;
                    momentsMoments.push(momentsMoment);
                }
            }

            return momentsMoments;
        }

        function getDuration(momentMoments)
        {
            var lastMomentMoment = momentMoments[momentMoments.length - 1];

            return (lastMomentMoment.msPositionInChord + lastMomentMoment.msDuration);
        }

        function getEnvsMoments(envsElem, msDuration)
        {
            var i, envElem, envsMoments, status, data1, vts,
                envsChildren = envsElem.children,
                controlMessages, controlMessagesArray = [];

            function getVtsData2ConstD1(envElem, data1)
            {
                var i, vtElem, envElemChildren = envElem.children, vt, vts = [];

                for(i = 0; i < envElemChildren.length; ++i)
                {
                    if(envElemChildren[i].nodeName === "vt")
                    {
                        vtElem = envElemChildren[i];
                        vt = {};
                        vt.data1 = data1;
                        vt.data2 = parseInt(vtElem.getAttribute("d2"), 10);
                        vt.msDur = parseInt(vtElem.getAttribute("msDur"), 10);
                        vts.push(vt);
                    }
                }
                return vts;
            }

            function getVtsData1UndefinedData2(envElem)
            {
                var i, vtElem, envElemChildren = envElem.children, vt, vts = [];

                for(i = 0; i < envElemChildren.length; ++i)
                {
                    if(envElemChildren[i].nodeName === "vt")
                    {
                        vtElem = envElemChildren[i];
                        vt = {};
                        vt.data1 = parseInt(vtElem.getAttribute("d1"), 10);
                        vt.msDur = parseInt(vtElem.getAttribute("msDur"), 10);
                        vts.push(vt);
                    }
                }

                return vts;
            }

            function getVtsData1AndData2(envElem)
            {
                var i, vtElem, envElemChildren = envElem.children, vt, vts = [];

                for(i = 0; i < envElemChildren.length; ++i)
                {
                    if(envElemChildren[i].nodeName === "vt")
                    {
                        vtElem = envElemChildren[i];
                        vt = {};
                        vt.data1 = parseInt(vtElem.getAttribute("d1"), 10);
                        vt.data2 = parseInt(vtElem.getAttribute("d2"), 10);
                        vt.msDur = parseInt(vtElem.getAttribute("msDur"), 10);
                        vts.push(vt);
                    }
                }
                return vts;
            }

            // returns an array of objects, each of which has an .msPositionInChord and a single .message property
            function getControlMessages(status, vts, msDuration)
            {
                var gridMessages, vtsMessages, controlMessages;

                function removeDuplicates(vts)
                {
                    var i, uniqueVts = [], prevVt;

                    function areDifferent(vt1, vt2)
                    {
                        var unequal = true;
                        // status byte is always equal here
                        if((vt1.data1 === vt2.data1)
                        && ((vt1.data2 === undefined && vt2.data2 === undefined) || (vt1.data2 === vt2.data2)))
                        {
                            unequal = false;
                        }

                        return unequal;
                    }

                    uniqueVts.push(vts[0]);
                    prevVt = vts[0];

                    for(i = 1; i < vts.length; ++i)
                    {
                        if(areDifferent(prevVt, vts[i]))
                        {
                            uniqueVts.push(vts[i]);
                            prevVt = vts[i];
                        }
                        else
                        {
                            prevVt.msDur += vts[i].msDur;
                        }
                    }
                    return uniqueVts;
                }

                function getVtsMessages(status, vts)
                {
                    var i, vtsMessages = [], vtsMoment,
                        msg, msPos = 0, vt, bytes = [];

                    for(i = 0; i < vts.length; ++i)
                    {
                        vtsMoment = {};
                        vtsMoment.msPositionInChord = msPos;
                        vt = vts[i];

                        bytes.length = 0;
                        bytes.push(status);
                        bytes.push(vt.data1);
                        if(vt.data2 !== undefined)
                        {
                            bytes.push(vt.data2);
                        }

                        msg = getMsg(bytes);
                        vtsMoment.message = msg;
                        vtsMessages.push(vtsMoment);

                        msPos += vt.msDur;
                    }
                    return vtsMessages;
                }

                function getGridMessages(status, vts, msDuration)
                {
                    var i, msg, vtsState = {}, bytes = [], gridMessages;

                    function getEmptyMessageGrid(msDuration)
                    {
                        var mmt, mmts = [], msPos = 0;

                        while(msPos < msDuration)
                        {
                            mmt = {};
                            mmt.msPositionInChord = msPos;
                            // mmt.message is undefined
                            mmts.push(mmt);
                            msPos += SLIDER_MILLISECONDS;
                        }

                        return mmts;
                    }

                    // returns the vtsState at msPos.
                    // vtsState.vtIndex -- the index in vts at or before msPos;
                    // vtsState.gridData1 -- the value to set in a message at msPos;
                    // vtsState.gridData2 -- the value to set in a message at msPos;
                    // vtsState.currentVtMsPos -- vts[vtsState.vtIndex].msPos;
                    // vtsState.nextVtMsPos -- vts[vtsState.vtIndex + 1].msPos;
                    // vtsState.vtData1; -- vts[vtsState.vtIndex].data1 // required in comparison outside this function
                    // vtsState.vtData2; -- vts[vtsState.vtIndex].data2 // required in comparison outside this function
                    function nextData(msPos, vts, vtsState)
                    {
                        var data1IncrPerMillisecond = 0, data2IncrPerMillisecond = 0;

                        vtsState.gridData1 = undefined;
                        vtsState.gridData2 = undefined;
                        vtsState.vtData1 = undefined;
                        vtsState.vtData2 = undefined;

                        while( vtsState.vtIndex < (vts.length - 2)
                        && ((msPos >= vtsState.currentVtMsPos && msPos < vtsState.nextVtMsPos) === false))
                        {
                            vtsState.vtIndex++;
                            vtsState.currentVtMsPos = vtsState.nextVtMsPos;
                            vtsState.nextVtMsPos += vts[vtsState.vtIndex].msDur;
                        }

                        if(msPos >= vtsState.currentVtMsPos && msPos < vtsState.nextVtMsPos)
                        {
                            vtsState.vtData1 = vts[vtsState.vtIndex].data1;
                            data1IncrPerMillisecond =
                                (vts[vtsState.vtIndex + 1].data1 - vts[vtsState.vtIndex].data1) / vts[vtsState.vtIndex].msDur;
                            vtsState.gridData1 =
                                Math.floor(vtsState.vtData1 + ((msPos - vtsState.currentVtMsPos) * data1IncrPerMillisecond));

                            if(vts[vtsState.vtIndex].data2 !== undefined)
                            {
                                vtsState.vtData2 = vts[vtsState.vtIndex].data2;
                                data2IncrPerMillisecond =
                                    (vts[vtsState.vtIndex + 1].data2 - vts[vtsState.vtIndex].data2) / vts[vtsState.vtIndex].msDur;
                                vtsState.gridData2 =
                                    Math.floor(vtsState.vtData2 + ((msPos - vtsState.currentVtMsPos) * data2IncrPerMillisecond));
                            }
                        }

                        return vtsState;
                    }

                    function gridIsDifferent(vtsState)
                    {
                        var different = true;

                        if(vtsState.gridData1 !== undefined)
                        {
                            if(vtsState.gridData2 === undefined)
                            {
                                if(vtsState.gridData1 === vtsState.vtData1 )
                                {
                                    different = false;
                                }
                            }
                            else if(vtsState.gridData1 === vtsState.vtData1 && vtsState.gridData2 === vtsState.vtData2)
                            {
                                different = false;
                            }
                        }
                        return different;
                    }

                    gridMessages = getEmptyMessageGrid(msDuration);

                    if(gridMessages.length > 1 && vts.length > 1)
                    {
                        // messageGrid[0].message is always undefined. The message will be added from vts later...
                        vtsState.vtIndex = 0;
                        vtsState.currentVtMsPos = 0;
                        vtsState.nextVtMsPos = vts[0].msDur;

                        for(i = 1; i < gridMessages.length; ++i)
                        {
                            vtsState = nextData(gridMessages[i].msPositionInChord, vts, vtsState);

                            // the vtsState.vtData1 and vtsState.vtData2 values will be inserted later
                            if(gridIsDifferent(vtsState))
                            {
                                bytes.length = 0;
                                bytes.push(status);
                                bytes.push(vtsState.gridData1);
                                if(vtsState.gridData2 !== undefined)
                                {
                                    bytes.push(vtsState.gridData2);
                                }

                                msg = getMsg(bytes);

                                gridMessages[i].message = msg;
                            }
                        }
                    }

                    return gridMessages;
                }

                function getCombinedMessages(vtsMessages, gridMessages)
                {
                    var combinedMessages = [], mgIndex = 0, nGridMessages = gridMessages.length,
                    i, vtsIndex = 0, nVtsMessages = vtsMessages.length;

                    for(i = 0; i < nVtsMessages; ++i)
                    {
                        console.assert(vtsMessages[i].message !== undefined);
                        // gridMessages messages can be undefined.
                    }

                    while((mgIndex === nGridMessages && vtsIndex === nVtsMessages) === false)
                    {
                        if(vtsIndex === nVtsMessages)
                        {
                            while(mgIndex < nGridMessages)
                            {
                                if(gridMessages[mgIndex].message !== undefined)
                                {
                                    combinedMessages.push(gridMessages[mgIndex]);
                                }
                                mgIndex++;
                            }
                        }
                        else if(mgIndex === nGridMessages)
                        {
                            while(vtsIndex < nVtsMessages)
                            {
                                combinedMessages.push(vtsMessages[vtsIndex++]);
                            }
                        }
                        else
                        {
                            combinedMessages.push(vtsMessages[vtsIndex++]);
                            if(vtsIndex < nVtsMessages)
                            {
                                while(mgIndex < nGridMessages && vtsMessages[vtsIndex].msPositionInChord > gridMessages[mgIndex].msPositionInChord)
                                {
                                    if(gridMessages[mgIndex].message !== undefined)
                                    {
                                        combinedMessages.push(gridMessages[mgIndex]);
                                    }
                                    mgIndex++;
                                }
                            }
                        }
                    }

                    return combinedMessages;
                }

                vts = removeDuplicates(vts);
                vtsMessages = getVtsMessages(status, vts);
                gridMessages = getGridMessages(status, vts, msDuration);
                controlMessages = getCombinedMessages(vtsMessages, gridMessages);

                return controlMessages;
            }

            // returns an array of Moments, each of which has an .msPositionInChord and .messages property.
            function getCombinedControlMessages(controlMessagesArray)
            {
                var envMoments = [], i, msPos, moment, indices = [],
                    cma = controlMessagesArray, nControls = controlMessagesArray.length;

                function finished(cma, indices)
                {
                    var i, done = true;

                    for(i = 0; i < cma.length; ++i)
                    {
                        if(indices[i] < cma[i].length)
                        {
                            done = false;
                            break;
                        }
                    }
                    return done;
                }

                // returns the smallest msPos pointed at by any of the indices
                function nextMsPos(cma, indices)
                {
                    var i, val, smallestMsPos = Number.MAX_SAFE_INTEGER;

                    for(i = 0; i < indices.length; ++i)
                    {
                        if(indices[i] < cma[i].length)
                        {
                            val = cma[i][indices[i]].msPositionInChord;
                            smallestMsPos = (smallestMsPos < val) ? smallestMsPos : val;
                        }
                    }
                    return smallestMsPos;
                }

                for(i = 0; i < nControls; ++i)
                {
                    indices.push(0);
                }

                while(finished(cma, indices) === false)
                {
                    msPos = nextMsPos(cma, indices);
                    moment = new Moment(msPos);
                    envMoments.push(moment);

                    for(i = 0; i < nControls; ++i)
                    {
                        if(indices[i] < cma[i].length && cma[i][indices[i]].msPositionInChord === msPos)
                        {
                            moment.messages.push(cma[i][indices[i]].message);
                            indices[i]++;
                        }
                    }
                }
                return envMoments;
            }

            for(i = 0; i < envsChildren.length; ++i)
            {
                if(envsChildren[i].nodeName === "env")
                {
                    envElem = envsChildren[i];
                    status = parseInt(envElem.getAttribute("s"), 16);
                    switch(Math.floor(status / 16))
                    {
                        case 10: // 0xA Aftertouch
                            data1 = parseInt(envElem.getAttribute("d1"), 10);
                            vts = getVtsData2ConstD1(envElem, data1);
                            break;
                        case 11: // 0xB ControlChange
                            data1 = parseInt(envElem.getAttribute("d1"), 10);
                            vts = getVtsData2ConstD1(envElem, data1);
                            break;
                        case 13: // 0xD ChannelPressure
                            vts = getVtsData1UndefinedData2(envElem);
                            break;
                        case 14: // 0xE PitchWheel
                            vts = getVtsData1AndData2(envElem);
                            break;
                        default:
                            break;
                    }
                    controlMessages = getControlMessages(status, vts, msDuration);
                    controlMessagesArray.push(controlMessages);
                }
            }

            envsMoments = getCombinedControlMessages(controlMessagesArray);

            return envsMoments;
        }

        // The momentMoments objects are pseudo moments having the following properties:
        //     .msDuration
        //     .msPositionInChord
        //     .noteOffMsgs
        //     .noteOnMsgs
        //     .switchesMsgs
        // The envsMoments are real Moments having the following set properties:
        //     .msPositionInChord
        //     .messages
        // msDuration is the duration of the MidiChord.
        // Returns an array of fully constructed Moments
        // The messages inside each moment are in the following order:
        //     noteOffs
        //     switches
        //     envelope
        //     noteOns
        function getCombinedMoments(momentMoments, envsMoments, msDuration, systemIndex)
        {
            var i, j, msPos, msPositions, combinedMoment, combinedMoments = [],
                mmIndex, emIndex, mMoment, noteOffMsgs, switchesMsgs, envMsgs, noteOnMsgs;

            function getMsPositions(momentMoments, envsMoments)
            {
                var i, msPositions = [];

                for(i = 0; i < momentMoments.length; ++i)
                {
                    msPositions.push(momentMoments[i].msPositionInChord);
                }
                for(i = 0; i < envsMoments.length; ++i)
                {
                    msPos = envsMoments[i].msPositionInChord;
                    if(msPositions.indexOf(msPos) < 0)
                    {
                        msPositions.push(msPos);
                    }
                }
                msPositions.sort(function(a, b) { return a - b; });
                return msPositions;
            }

            function compare(x) { return msPos === x.msPositionInChord; }

            msPositions = getMsPositions(momentMoments, envsMoments);

            for(i = 0; i < msPositions.length; ++i)
            {
                msPos = msPositions[i]; 
                combinedMoment = new Moment(msPos, systemIndex);
                combinedMoments.push(combinedMoment);

                mmIndex = momentMoments.findIndex(compare);
                emIndex = envsMoments.findIndex(compare);

                if(mmIndex >= 0)
                {
                    mMoment = momentMoments[mmIndex];
                    if(mMoment.noteOffMsgs !== undefined)
                    {
                        noteOffMsgs = mMoment.noteOffMsgs;
                        for(j = 0; j < noteOffMsgs.length; ++j)
                        {
                            combinedMoment.messages.push(noteOffMsgs[j]);
                        }
                    }

                    if(mMoment.switchesMsgs !== undefined)
                    {
                        switchesMsgs = mMoment.switchesMsgs;
                        for(j = 0; j < switchesMsgs.length; ++j)
                        {
                            combinedMoment.messages.push(switchesMsgs[j]);
                        }
                    }
                }

                if(emIndex >= 0)
                {
                    envMsgs = envsMoments[emIndex].messages;
                    for(j = 0; j < envMsgs.length; ++j)
                    {
                        combinedMoment.messages.push(envMsgs[j]);
                    }
                }

                if(mmIndex >= 0 && mMoment.noteOnMsgs !== undefined)
                {
                    noteOnMsgs = mMoment.noteOnMsgs;
                    for(j = 0; j < noteOnMsgs.length; ++j)
                    {
                        combinedMoment.messages.push(noteOnMsgs[j]);
                    }
                }
            }

            return combinedMoments;
        }

        for(i = 0; i < scoreMidiChildren.length; ++i)
        {
            scoreMidiChild = scoreMidiChildren[i];
            if(scoreMidiChild.nodeName === "moments")
            {
                momentMoments = getMomentsMoments(scoreMidiChild);
                msDuration = getDuration(momentMoments);
                this.msDurationInScore = msDuration;
            }

            if(scoreMidiChild.nodeName === "envs")
            {
                envsMoments = getEnvsMoments(scoreMidiChild, msDuration);
            }
        }

        moments = getCombinedMoments(momentMoments, envsMoments, msDuration, systemIndex);

        return moments;
    };

    /***** The following functions are defined for both MidiChords and MidiRests *****************/

    // The chord must be at or straddle the start marker.
    // This function sets the chord to the state it should have when a performance starts.
    // this.currentMoment is set to the first moment at or after startMarkerMsPositionInScore.
    // this.currentMoment will be undefined if there are no moments at or after startMarkerMsPositionInScore. 
    MidiChord.prototype.setToStartMarker = function(startMarkerMsPositionInScore)
    {
        var
        nMoments = this.moments.length,
        currentIndex, currentPosition;

        console.assert(
            ((this.msPositionInScore <= startMarkerMsPositionInScore)
            && (this.msPositionInScore + this.msDurationInScore > startMarkerMsPositionInScore)),
            "This chord or rest must be at or straddle the start marker.");

        for(currentIndex = 0; currentIndex < nMoments; ++currentIndex)
        {
            currentPosition = this.msPositionInScore + this.moments[currentIndex].msPositionInChord;
            if(currentPosition >= startMarkerMsPositionInScore)
            {
                break;
            }
        }
        this._currentMomentIndex = currentIndex;
        this.currentMoment = this.moments[currentIndex];
    };

    MidiChord.prototype.advanceCurrentMoment = function()
    {
        var returnMoment;

        console.assert(this.currentMoment !== null, "CurrentMoment should never be null here!");

        this._currentMomentIndex++;
        returnMoment = null;
        if(this._currentMomentIndex < this.moments.length)
        {
            this.currentMoment = this.moments[this._currentMomentIndex];
            returnMoment = this.currentMoment;
        }
        return returnMoment;
    };

    MidiChord.prototype.setToStartAtBeginning = function()
    {
        this._currentMomentIndex = 0;
        this.currentMoment = this.moments[0];
    };

    MidiRest.prototype = MidiChord.prototype;

    return publicMidiObjectAPI;
}());

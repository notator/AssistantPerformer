const
	COMMAND =
	{
		NOTE_OFF: 0x80,
		NOTE_ON: 0x90,
		AFTERTOUCH: 0xA0,
		CONTROL_CHANGE: 0xB0,
		PROGRAM_CHANGE: 0xC0,
		CHANNEL_PRESSURE: 0xD0,
		PITCH_WHEEL: 0xE0
	},

	// These constants can be received or sent live during performances.
	// They are not stored in files.
	// The MIDI standard does not define 0xF4, 0xF5 or 0xFD.
	REAL_TIME =
	{
		// 0xF0 is SYSTEM_EXCLUSIVE.START (used in Standard MIDI Files)
		MTC_QUARTER_FRAME: 0xF1,
		SONG_POSITION_POINTER: 0xF2,
		SONG_SELECT: 0xF3,
		// 0xF4 is not defined by the MIDI standard
		// 0xF5 is not defined by the MIDI standard
		TUNE_REQUEST: 0xF6,
		// 0xF7 is SYSTEM_EXCLUSIVE.END (used in Standard MIDI Files) 
		MIDI_CLOCK: 0xF8,
		MIDI_TICK: 0xF9,
		MIDI_START: 0xFA,
		MIDI_CONTINUE: 0xFB,
		MIDI_STOP: 0xFC,
		// 0xFD is not defined by the MIDI standard
		ACTIVE_SENSE: 0xFE,
		RESET: 0xFF
	},

	// These are all the MIDI CONTROLS I use for the moment (Feb. 2013).
	// This list could be easily be extended/completed.
	// Note that I am currently only using the "coarse" versions of these controls
	CONTROL =
	{
		MODWHEEL: 1,
		DATA_ENTRY_COARSE: 6,
		VOLUME: 7,
		PAN: 10,
		EXPRESSION: 11,
		TIMBRE: 71,
		BRIGHTNESS: 74,
		EFFECTS: 91,
		TREMOLO: 92,
		CHORUS: 93,
		CELESTE: 94,
		PHASER: 95,
		REGISTERED_PARAMETER_COARSE: 101,
		ALL_SOUND_OFF: 120,
		ALL_CONTROLLERS_OFF: 121,
		ALL_NOTES_OFF: 123
	},

	SYSTEM_EXCLUSIVE =
	{
		START: 0xF0,
		END: 0xF7
	},

	// These GM_PATCH_NAMES are written here exactly as defined at MIDI.org: 
	// http://midi.org/techspecs/gm1sound.php
	GM_PATCH_NAMES =
		[
			// Piano (1-8)
			"Acoustic Grand Piano", "Bright Acoustic Piano", "Electric Grand Piano", "Honky-tonk Piano", "Electric Piano 1",
			"Electric Piano 2", "Harpsichord", "Clavi",
			// Chromatic Percussion (9-16)
			"Celesta", "Glockenspiel", "Music Box", "Vibraphone", "Marimba", "Xylophone", "Tubular Bells", "Dulcimer",
			// Organ (17-24)
			"Drawbar Organ", "Percussive Organ", "Rock Organ", "Church Organ", "Reed Organ", "Accordion", "Harmonica",
			"Tango Accordion",
			// Guitar (25-32)
			"Acoustic Guitar (nylon)", "Acoustic Guitar (steel)", "Electric Guitar (jazz)", "Electric Guitar (clean)",
			"Electric Guitar (muted)", "Overdriven Guitar", "Distortion Guitar", "Guitar harmonics",
			// Bass (33-40)
			"Acoustic Bass", "Electric Bass (finger)", "Electric Bass (pick)", "Fretless Bass", "Slap Bass 1", "Slap Bass 2",
			"Synth Bass 1", "Synth Bass 2",
			// Strings (41-48)
			"Violin", "Viola", "Cello", "Contrabass", "Tremolo Strings", "Pizzicato Strings", "Orchestral Harp", "Timpani",
			// Ensemble (49-56)
			"String Ensemble 1", "String Ensemble 2", "SynthStrings 1", "SynthStrings 2", "Choir Aahs", "Voice Oohs", "Synth Voice",
			"Orchestra Hit",
			// Brass (57-64)
			"Trumpet", "Trombone", "Tuba", "Muted Trumpet", "French Horn", "Brass Section", "SynthBrass 1", "SynthBrass 2",
			// Reed (65-72)
			"Soprano Sax", "Alto Sax", "Tenor Sax", "Baritone Sax", "Oboe", "English Horn", "Bassoon", "Clarinet",
			// Pipe (73-80)
			"Piccolo", "Flute", "Recorder", "Pan Flute", "Blown Bottle", "Shakuhachi", "Whistle", "Ocarina",
			// Synth Lead (81-88)
			"Lead 1 (square)", "Lead 2 (sawtooth)", "Lead 3 (calliope)", "Lead 4 (chiff)", "Lead 5 (charang)", "Lead 6 (voice)",
			"Lead 7 (fifths)", "Lead 8 (bass + lead)",
			// Synth Pad (89-96)
			"Pad 1 (new age)", "Pad 2 (warm)", "Pad 3 (polysynth)", "Pad 4 (choir)", "Pad 5 (bowed)", "Pad 6 (metallic)",
			"Pad 7 (halo)", "Pad 8 (sweep)",
			// Synth Effects (97-104)
			"FX 1 (rain)", "FX 2 (soundtrack)", "FX 3 (crystal)", "FX 4 (atmosphere)", "FX 5 (brightness)", "FX 6 (goblins)",
			"FX 7 (echoes)", "FX 8 (sci-fi)",
			// Ethnic (105-112)
			"Sitar", "Banjo", "Shamisen", "Koto", "Kalimba", "Bag pipe", "Fiddle", "Shanai",
			// Percussive (113-120)
			"Tinkle Bell", "Agogo", "Steel Drums", "Woodblock", "Taiko Drum", "Melodic Tom", "Synth Drum", "Reverse Cymbal",
			// Sound Effects (121-128)
			"Guitar Fret Noise", "Breath Noise", "Seashore", "Bird Tweet", "Telephone Ring", "Helicopter", "Applause",
			"Gunshot"
		],

	// These GM_PERCUSSION_NAMES are written here exactly as defined at MIDI.org: 
	// http://midi.org/techspecs/gm1sound.php
	GM_PERCUSSION_NAMES =
		[
			"Acoustic Bass Drum",// noteIndex 34
			"Bass Drum 1",   // 35
			"Side Stick",    // 36
			"Acoustic Snare",// 37
			"Hand Clap",     // 38
			"Electric Snare",// 39
			"Low Floor Tom", // 40
			"Closed Hi Hat", // 41
			"High Floor Tom",// 42
			"Pedal Hi-Hat",  // 43
			"Low Tom",       // 44
			"Open Hi-Hat",   // 45
			"Low-Mid Tom",   // 46
			"Hi-Mid Tom",    // 47
			"Crash Cymbal 1",// 48
			"High Tom",      // 49
			"Ride Cymbal 1", // 50
			"Chinese Cymbal",// 51
			"Ride Bell",     // 52
			"Tambourine",    // 53
			"Splash Cymbal", // 54
			"Cowbell",       // 55
			"Crash Cymbal 2",// 56
			"Vibraslap",     // 57
			"Ride Cymbal 2", // 58
			"Hi Bongo",      // 59
			"Low Bongo",     // 60
			"Mute Hi Conga", // 61
			"Open Hi Conga", // 62
			"Low Conga",     // 63
			"High Timbale",  // 64
			"Low Timbale",   // 65
			"High Agogo",    // 66
			"Low Agogo",     // 67
			"Cabasa",        // 68
			"Maracas",       // 69
			"Short Whistle", // 70
			"Long Whistle",  // 71
			"Short Guiro",   // 72
			"Long Guiro",    // 73
			"Claves",        // 74
			"Hi Wood Block", // 75
			"Low Wood Block",// 76
			"Mute Cuica",    // 77
			"Open Cuica",    // 78
			"Mute Triangle", // 79
			"Open Triangle"  // 80	 
		],

	// True if constant is one of the REAL_TIME status bytes, otherwise false
	isRealTimeStatus = function(constant)
	{
		var result = false;
		if((constant === this.REAL_TIME.MTC_QUARTER_FRAME)
			|| (constant === this.REAL_TIME.SONG_POSITION_POINTER)
			|| (constant === this.REAL_TIME.SONG_SELECT)
			|| (constant === this.REAL_TIME.TUNE_REQUEST)
			|| (constant === this.REAL_TIME.MIDI_CLOCK)
			|| (constant === this.REAL_TIME.MIDI_TICK)
			|| (constant === this.REAL_TIME.MIDI_START)
			|| (constant === this.REAL_TIME.MIDI_CONTINUE)
			|| (constant === this.REAL_TIME.MIDI_STOP)
			|| (constant === this.REAL_TIME.ACTIVE_SENSE)
			|| (constant === this.REAL_TIME.RESET))
		{
			result = true;
		}
		return result;
	},

	generalMIDIPatchName = function(patchIndex)
	{
		var patchName;
		if(patchIndex >= 0 && patchIndex <= GM_PATCH_NAMES.length)
		{
			patchName = GM_PATCH_NAMES[patchIndex];
		}
		else
		{
			console.warn("Bad argument");
		}
		return patchName;
	},

	generalMIDIPercussionName = function(noteIndex)
	{
		var
			percussionName,
			indexOfFirstPercussionName = 34,
			index = noteIndex - indexOfFirstPercussionName;

		if(index >= 0 && index <= GM_PERCUSSION_NAMES.length)
		{
			percussionName = GM_PERCUSSION_NAMES[index];
		}
		else
		{
			console.warn("Bad argument");
		}
		return percussionName;
	},

	pitchwheelCombinedValue = function(data1, data2)
	{
		return (data2 << 7) + data1;
	},

	constants =
	{
		COMMAND: COMMAND,
		REAL_TIME: REAL_TIME,
		CONTROL: CONTROL,
		SYSTEM_EXCLUSIVE: SYSTEM_EXCLUSIVE,

		INPUT_ERROR_COLOR: "#FFDCDC", // The colour to which an input's background is set when there is an error.
		UNDEFINED_TIMESTAMP: -1,
		SLIDER_MILLISECONDS: 100, // The rate at which midi slider commands are sent (ms/sec).

		isRealTimeStatus: isRealTimeStatus,
		generalMIDIPatchName: generalMIDIPatchName,
		generalMIDIPercussionName: generalMIDIPercussionName,
		pitchwheelCombinedValue: pitchwheelCombinedValue
	};

export { constants };


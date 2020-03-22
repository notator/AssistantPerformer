export class TrkOptions
{
	constructor(trkOptionsNode)
	{
		var i, attributes, attr, attrLen,
			hasNodeArg = !(trkOptionsNode === undefined || trkOptionsNode.attributes === undefined || trkOptionsNode.attributes.length === 0);

		if(hasNodeArg)
		{
			attributes = trkOptionsNode.attributes;

			attrLen = attributes.length;
			for(i = 0; i < attrLen; ++i)
			{
				attr = attributes[i];
				switch(attr.name)
				{
					case "pedal":
						this.pedal = attr.value;
						break;

					case "velocity":
						this.velocity = attr.value;
						break;
					case "minVelocity": // is defined if velocity is defined
						this.minVelocity = parseInt(attr.value, 10);
						break;

					case "speed":
						this.speed = parseFloat(attr.value, 10);
						break;

					case "trkOff":
						this.trkOff = attr.value;
						break;

					default:
						alert(">>>>>>>>>> Illegal trkOptions attribute <<<<<<<<<<");
						console.assert(false);
				}
			}
		}
	}

	clone()
	{
		var cfOptions = new TrkOptions();

		if(this.pedal)
		{
			cfOptions.pedal = this.pedal;
		}

		if(this.velocity)
		{
			cfOptions.velocity = this.velocity;
			cfOptions.minVelocity = this.minVelocity;
		}

		if(this.speed)
		{
			cfOptions.speed = this.speed;
		}

		if(this.trkOff)
		{
			cfOptions.trkOff = this.trkOff;
		}

		return cfOptions;
	}
}

class Designation{
    constructor(value,tick,sub){
        this.num = undefined;
        if(value instanceof Array){
            let n;
            if(value.length>2){
                n = value[1];
                value[1] = zeroPad(n,2);
            }else{
                n = value[0];
                value[0] = zeroPad(n,2);
            }
            this.value = value.join('');
            if(typeof n === 'number') this.num = n;
        }else this.value = value;
        this.effectiveTicks = [tick];
        this.hideTicks = [];
        this.subBasin = sub || 0;
        if(this.value instanceof LoadData) this.load(this.value);
    }

    isName(){
        if(this.num===undefined) return true;
    }

    truncate(){
        if(this.isName()){
            return ({
                'Casual*':'\u03B1',
                'Throwbie*':'\u03B2',
                'Nathan*':'\u03B3',
                'Screensaver*':'\u03B4',
                'Turret*':'\u03B5',
                'Chop*':'\u03B6',
                'Creeper*':'\u03B7',
                'Streko*':'\u03B8',
                'Porsche*':'\u03B9',
                'Aidan*':'\u03BA',
                'Shadow*':'\u03BB',
                'Celia*':'\u03BC',
                'ENC*':'\u03BD',
                'Juke*':'\u03BE',
                'Tablo*':'\u03BF',
                'Skirm*':'\u03C0',
                'Mash*':'\u03C1',
                'Khobehh*':'\u03C3',
                'Super*':'\u03C4',
                'SWX*':'\u03C5',
                'Luke*':'\u03C6',
                'Paxton*':'\u03C7',
                'AJ*':'\u03C8',
                'Storminator*':'\u03C9'
            })[this.value] || this.value.slice(0,1);
        }else return this.num + '';
    }
    
    activeAt(t){
        let e;
        let h;
        for(let i=0;i<this.effectiveTicks.length;i++){
            let n = this.effectiveTicks[i];
            if(t>=n && (!e || n>e)) e = n;
        }
        for(let i=0;i<this.hideTicks.length;i++){
            let n = this.hideTicks[i];
            if(t>=n && (!h || n>h)) h = n;
        }
        if(e && (!h || e>h)) return e;
        return false;
    }

    hide(t){
        if(typeof t === 'number') this.hideTicks.push(t);
    }

    show(t){
        if(typeof t === 'number') this.effectiveTicks.push(t);
    }

    save(){
        let o = {};
        for(let p of [
            'value',
            'num',
            'effectiveTicks',
            'hideTicks',
            'subBasin'
        ]) o[p] = this[p];
        return o;
    }

    load(data){
        if(data instanceof LoadData){
            let o = data.value;
            for(let p of [
                'value',
                'num',
                'subBasin'
            ]) this[p] = o[p];
            for(let p of [
                'effectiveTicks',
                'hideTicks'
            ]) if(o[p]) this[p] = o[p];
            if(o.effectiveTick) this.effectiveTicks.push(o.effectiveTick);
        }
    }
}

class DesignationSystem{
    constructor(data){
        let opts;
        if(data && !(data instanceof LoadData)) opts = data;
        else opts = {};
        this.subBasin = undefined;
        this.displayName = opts.displayName;
        // if designations should be secondary instead of primary
        this.secondary = opts.secondary;
        this.numbering = {};
        // set to false to disable numbering (prefixes and suffixes may still be used for numbered designations from a parent sub-basin)
        this.numbering.enabled = opts.numEnable===undefined ? true : opts.numEnable;
        // a prefix for numbered designations (e.g. "BOB" and "ARB")
        this.numbering.prefix = undefined;
        if(opts.prefix!==undefined) this.numbering.prefix = opts.prefix;
        else if(this.numbering.enabled) this.numbering.prefix = '';
        // a suffix for numbered designations (e.g. "L" and "E")
        this.numbering.suffix = undefined;
        if(opts.suffix!==undefined) this.numbering.suffix = opts.suffix;
        else if(this.numbering.enabled){
            if(opts.prefix!==undefined) this.numbering.suffix = '';
            else this.numbering.suffix = DEPRESSION_LETTER;
        }
        // scale category threshold for numbering a system (overrides Scale.numberingThreshold)
        this.numbering.threshold = opts.numThresh;
        // behavior for primary designations of basin-crossing systems [may need more testing]
        // 0 = always redesignate (use previous designation from this sub-basin if exists)
        // 1 = strictly redesignate (use new designation even if a previous one from this sub-basin exists)
        // 2 = redesignate regenerating systmes (keep designations of systems that retain TC status through the crossing; use previous designation if applicable)
        // 3 = strictly redesignate regenerating systems (always use new designation for regenerating systems even if previous one exists)
        // 4 = never redesignate (keep designations regardless of retaining TC status)
        this.numbering.crossingMode = opts.numCross===undefined ? DESIG_CROSSMODE_ALWAYS : opts.numCross;
        this.naming = {};
        // main name lists to be used
        this.naming.mainLists = [];
        if(opts.mainLists instanceof Array) this.naming.mainLists = opts.mainLists;
        // auxiliary lists to be used if the main list for a year is exhausted (only applicable to annual naming)
        this.naming.auxiliaryLists = [];
        if(opts.auxLists instanceof Array) this.naming.auxiliaryLists = opts.auxLists;
        // lists to be used for automatic replacement of names on other lists [To Be Implemented]
        this.naming.replacementLists = [];
        if(opts.repLists instanceof Array) this.naming.replacementLists = opts.repLists;
        // whether naming should be annual (Atl/EPac/SWIO/PAGASA) or continuous (WPac/CPac/Aus/etc.)
        this.naming.annual = opts.annual;
        // the year to anchor the cycle of annual lists to (this year will use the #0 (first) name list)
        this.naming.annualAnchorYear = opts.anchor===undefined ? 1979 : opts.anchor;
        // counter for continuous name assignment (only applicable to continuous naming)
        this.naming.continuousNameIndex = opts.indexOffset || 0;
        // scale category threshold for naming a system (overrides Scale.namingThreshold)
        this.naming.threshold = opts.nameThresh;
        // behavior for primary designations of basin-crossing systems (see above)
        this.naming.crossingMode = opts.nameCross===undefined ? DESIG_CROSSMODE_STRICT_REGEN : opts.nameCross;
        if(data instanceof LoadData) this.load(data);
    }

    setSubBasin(sb){
        if(sb instanceof SubBasin) this.subBasin = sb;
    }

    addMainLists(...lists){
        for(let l of lists){
            if(l instanceof Array){
                this.naming.mainLists.push(l);
            }
        }
        return this;
    }

    addAuxiliaryLists(...lists){
        for(let l of lists){
            if(l instanceof Array){
                this.naming.auxiliaryLists.push(l);
            }
        }
        return this;
    }

    addReplacementLists(...lists){
        for(let l of lists){
            if(l instanceof Array){
                this.naming.replacementLists.push(l);
            }
        }
        return this;
    }

    setSecondary(v){
        this.secondary = !!v;
        return this;
    }

    setCrossingModes(numCM,nameCM){
        if(numCM !== undefined) this.numbering.crossingMode = numCM;
        if(nameCM !== undefined) this.naming.crossingMode = nameCM;
        return this;
    }

    setThresholds(numThresh,nameThresh){
        if(numThresh !== undefined) this.numbering.threshold = numThresh;
        if(nameThresh !== undefined) this.naming.threshold = nameThresh;
        return this;
    }

    setContinuousNameIndex(i){
        if(i !== undefined) this.naming.continuousNameIndex = i;
        return this;
    }

    getName(tick,year,index){
        if(this.naming.mainLists.length<1) return undefined;
        if(tick===undefined && this.subBasin) tick = this.subBasin.basin.tick;
        let name;
        if(this.naming.annual){
            if(year===undefined && this.subBasin) year = this.subBasin.basin.getSeason(tick);
            let y = year - this.naming.annualAnchorYear;
            let m = this.naming.mainLists;
            let numOfLists = m.length;
            let i = (y%numOfLists+numOfLists)%numOfLists;
            let l = m[i];
            if(index===undefined) index = 0;
            if(index>=l.length){
                index -= l.length;
                m = this.naming.auxiliaryLists;
                i = 0;
                let sum = 0;
                while(i<m.length && index-sum >= m[i].length){
                    sum += m[i].length;
                    i++;
                }
                if(i>=m.length) return undefined;
                index -= sum;
                name = m[i][index];
            }else name = l[index];
        }else{
            if(index===undefined) index = 0;
            let m = this.naming.mainLists;
            let i = 0;
            let sum = 0;
            while(i<m.length && index-sum >= m[i].length){
                sum += m[i].length;
                i++;
            }
            if(i>=m.length){
                index = 0;
                i = 0;
            }else index -= sum;
            name = m[i][index];
        }
        return new Designation(name,tick,this.subBasin ? this.subBasin.id : 0);
    }

    getNewName(){
        if(this.subBasin){
            let sb = this.subBasin;
            let basin = sb.basin;
            let t = basin.tick;
            let y = basin.getSeason(t);
            let season = basin.fetchSeason(y,false,true);
            let i;
            if(this.naming.annual) i = season.stats(sb.id).designationCounters.name++;
            else{
                i = this.naming.continuousNameIndex++;
                let totalLength = 0;
                for(let l of this.naming.mainLists) totalLength += l.length;
                if(this.naming.continuousNameIndex>=totalLength) this.naming.continuousNameIndex = 0;
            }
            return this.getName(t,y,i);
        }
        return undefined;
    }

    getNum(tick,index,altPre,altSuf){
        let pre = this.numbering.prefix;
        let suf = this.numbering.suffix;
        if(altPre!==undefined) pre = altPre;
        if(altSuf!==undefined) suf = altSuf;
        let num = [pre,index,suf];
        return new Designation(num,tick,this.subBasin ? this.subBasin.id : 0);
    }

    getNewNum(altPre,altSuf){
        if(this.subBasin){
            let sb = this.subBasin;
            let basin = sb.basin;
            let t = basin.tick;
            let season = basin.fetchSeason(t,true,true);
            let i = ++season.stats(sb.id).designationCounters.number; // prefix increment because numbering starts at 01
            let numDesig = this.getNum(t,i,altPre,altSuf);
            return numDesig;
        }
        return undefined;
    }

    clone(){
        let newDS = new DesignationSystem();
        newDS.secondary = this.secondary;
        newDS.displayName = this.displayName;
        let numg = this.numbering;
        let namg = this.naming;
        let Numg = newDS.numbering;
        let Namg = newDS.naming;
        for(let p of [
            'enabled',
            'prefix',
            'suffix',
            'threshold',
            'crossingMode'
        ]) Numg[p] = numg[p];
        for(let p of [
            'annual',
            'annualAnchorYear',
            'continuousNameIndex',
            'threshold',
            'crossingMode'
        ]) Namg[p] = namg[p];
        for(let p of [
            'mainLists',
            'auxiliaryLists',
            'replacementLists'
        ]) Namg[p] = JSON.parse(JSON.stringify(namg[p]));
        return newDS;
    }

    save(){
        let d = {};
        d.secondary = this.secondary;
        d.displayName = this.displayName;
        let numg = d.numbering = {};
        let namg = d.naming = {};
        let Numg = this.numbering;
        let Namg = this.naming;
        for(let p of [
            'enabled',
            'prefix',
            'suffix',
            'threshold',
            'crossingMode'
        ]) numg[p] = Numg[p];
        for(let p of [
            'mainLists',
            'auxiliaryLists',
            'replacementLists',
            'annual',
            'annualAnchorYear',
            'continuousNameIndex',
            'threshold',
            'crossingMode'
        ]) namg[p] = Namg[p];
        return d;
    }

    load(data){
        if(data instanceof LoadData){
            let d = data.value;
            this.secondary = d.secondary;
            this.displayName = d.displayName;
            let Numg = this.numbering;
            let Namg = this.naming;
            let numg = d.numbering;
            let namg = d.naming;
            for(let p of [
                'enabled',
                'prefix',
                'suffix',
                'threshold'
            ]) Numg[p] = numg[p];
            Numg.crossingMode = numg.crossingMode || 0;
            for(let p of [
                'mainLists',
                'auxiliaryLists',
                'replacementLists',
                'annual',
                'annualAnchorYear',
                'continuousNameIndex',
                'threshold'
            ]) Namg[p] = namg[p];
            Namg.crossingMode = namg.crossingMode===undefined ? DESIG_CROSSMODE_STRICT_REGEN : namg.crossingMode;
            for(let i=Namg.auxiliaryLists.length-1;i>=0;i--){
                let a = Namg.auxiliaryLists[i];
                if(a.length===1 && a[0]==="Unnamed") Namg.auxiliaryLists.splice(i,1);
            }
            if(data.format<FORMAT_WITH_SCALES){ // convert thresholds from pre-v0.2 values
                Numg.threshold = Scale.convertOldValue(Numg.threshold);
                Namg.threshold = Scale.convertOldValue(Namg.threshold);
            }
        }
    }

    static convertFromOldNameList(list){
        let annual = list[0] instanceof Array;
        let main = [];
        let aux = [];
        if(annual){
            for(let i=0;i<list.length-1;i++) main.push(JSON.parse(JSON.stringify(list[i])));
            let auxlist = list[list.length-1];
            if(auxlist && auxlist[0]!=="Unnamed") aux.push(JSON.parse(JSON.stringify(auxlist)));
        }else main.push(JSON.parse(JSON.stringify(list)));
        return new DesignationSystem({
            mainLists: main,
            auxLists: aux,
            annual: annual
        });
    }
}

DesignationSystem.atlantic = new DesignationSystem({
    displayName: 'Atlantic',
    suffix: 'L',
    annual: true,
    anchor: 1979,
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
    ],
    auxLists: [
        ['Casual*','Throwbie*','Nathan*','Screensaver*','Turret*','Chop*','Creeper*','Streko*','Porsche*','Aidan*','Shadow*','Celia*','ENC*','Juke*','Tablo*','Skirm*','Mash*','Khobehh*','Super*','SWX*','Luke*','Paxton*','AJ*','Storminator*'],
        ['A7777*','Antares**','Anthony***','Ben Herr*','BlueLizard**','Breeze***','Cube*','DixieAlley*','Dante**','FCX*','','HH*','Jeb*','Kaiser*','Kyrios**','Norway*','Oakhurst*','Pizza Rat*','Ronald*','SeeStars*','Tuslos*','WMJ*'] // Hebrew Alphabet not actually official, but added due to popular demand
    ]
});

DesignationSystem.easternPacific = new DesignationSystem({
    displayName: 'Eastern Pacific',
    suffix: 'E',
    annual: true,
    anchor: 1979,
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
    ],
    auxLists: [
        ['Casual*','Throwbie*','Nathan*','Screensaver*','Turret*','Chop*','Creeper*','Streko*','Porsche*','Aidan*','Shadow*','Celia*','ENC*','Juke*','Tablo*','Skirm*','Mash*','Khobehh*','Super*','SWX*','Luke*','Paxton*','AJ*','Storminator*'],
        ['A7777*','Antares**','Anthony***','Ben Herr*','BlueLizard**','Breeze***','Cube*','DixieAlley*','Dante**','FCX*','','HH*','Jeb*','Kaiser*','Kyrios**','Norway*','Oakhurst*','Pizza Rat*','Ronald*','SeeStars*','Tuslos*','WMJ*'] // Hebrew Alphabet not actually official, but added due to popular demand
    ]
});

DesignationSystem.centralPacific = new DesignationSystem({
    displayName: 'Central Pacific',
    suffix: 'C',
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
    ]
});

DesignationSystem.westernPacific = new DesignationSystem({
    displayName: 'Western Pacific',
    suffix: 'W',
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
});

DesignationSystem.westernPacific1979 = new DesignationSystem({
    displayName: 'Western Pacific (1979-1989)',
    suffix: 'W',
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
     ]
});

DesignationSystem.westernPacific1989 = new DesignationSystem({
    displayName: 'Western Pacific (1989-1995)',
    suffix: 'W',
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
});

DesignationSystem.westernPacific1996 = new DesignationSystem({
    displayName: 'Western Pacific (1996-1999)',
    suffix: 'W',
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
     ]
});

DesignationSystem.westernPacific2000 = new DesignationSystem({
    displayName: 'Western Pacific (2000-2005)',
    suffix: 'W',
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
    ]
});
        
    

DesignationSystem.PAGASA = new DesignationSystem({
    displayName: 'PAGASA',
    secondary: true,
    numEnable: false,
    annual: true,
    anchor: 1963,
    nameThresh: 0,
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
    ]
});

DesignationSystem.PAGASA1963 = new DesignationSystem({
    displayName: 'PAGASA (1963-2000)',
    secondary: true,
    numEnable: false,
    annual: true,
    anchor: 1963,
    nameThresh: 0,
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
     ]
});

DesignationSystem.PAGASA2001 = new DesignationSystem({
    displayName: 'PAGASA (2001-2004)',
    secondary: true,
    numEnable: false,
    annual: true,
    anchor: 1963,
    nameThresh: 0,
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
     ]
});

DesignationSystem.australianRegionBoM = new DesignationSystem({
    displayName: 'Australian Region (BoM)',
    suffix: 'U',
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
    ]
});

DesignationSystem.australianRegionJakarta = new DesignationSystem({
    displayName: 'Australian Region (Jakarta)',
    numEnable: false,
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
    ],
    replacementLists: [
        ['Casual*','Throwbie*','Nathan*','Screensaver*','Turret*','Chop*','Creeper*','Streko*','Porsche*','Aidan*','Shadow*','Celia*','ENC*','Juke*','Tablo*','Skirm*','Mash*','Khobehh*','Super*','SWX*','Luke*','Paxton*','AJ*','Storminator*']
    ]
});

DesignationSystem.australianRegionPortMoresby = new DesignationSystem({
    displayName: 'Australian Region (Port Moresby)',
    numEnable: false,
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
    ],
    replacementLists: [
        ['Casual*','Throwbie*','Nathan*','Screensaver*','Turret*','Chop*','Creeper*','Streko*','Porsche*','Aidan*','Shadow*','Celia*','ENC*','Juke*','Tablo*','Skirm*','Mash*','Khobehh*','Super*','SWX*','Luke*','Paxton*','AJ*','Storminator*']
    ]
});

DesignationSystem.northIndianOcean = new DesignationSystem({
    displayName: 'North Indian Ocean',
    numEnable: false,
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
    ]
});

DesignationSystem.southWestIndianOcean = new DesignationSystem({
    displayName: 'Southwest Indian Ocean',
    suffix: 'R',
    annual: true,
    anchor: 2017,
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
    ]
});

DesignationSystem.southPacific = new DesignationSystem({
    displayName: 'South Pacific',
    suffix: 'F',
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
    ],
    replacementLists: [
        ['Casual*','Throwbie*','Nathan*','Screensaver*','Turret*','Chop*','Creeper*','Streko*','Porsche*','Aidan*','Shadow*','Celia*','ENC*','Juke*','Tablo*','Skirm*','Mash*','Khobehh*','Super*','SWX*','Luke*','Paxton*','AJ*','Storminator*']
    ]
});

DesignationSystem.southAtlantic = new DesignationSystem({
    displayName: 'South Atlantic',
    suffix: 'Q',
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
    ]
});

DesignationSystem.atlantic1979 = new DesignationSystem({
    displayName: 'Atlantic (1979-1984)',
    suffix: 'L',
    annual: true,
    anchor: 1979,
    mainLists: [
        ['AS','Bob','Caiden','Doss','Ethan','Flasty','Gabe','Helix','Ivan','Jessica','Kevi','Lars','Mori','Neon','Obi','Packaged','RedPower','Sohum','TPE','VATracking','WXViking']
    ],
    auxLists: [
        ['Casual*','Throwbie*','Nathan*','Screensaver*','Turret*','Chop*','Creeper*','Streko*','Porsche*','Aidan*','Shadow*','Celia*','ENC*','Juke*','Tablo*','Skirm*','Mash*','Khobehh*','Super*','SWX*','Luke*','Paxton*','AJ*','Storminator*'],
        ['A7777*','Antares**','Anthony***','Ben Herr*','BlueLizard**','Breeze***','Cube*','DixieAlley*','Dante**','FCX*','','HH*','Jeb*','Kaiser*','Kyrios**','Norway*','Oakhurst*','Pizza Rat*','Ronald*','SeeStars*','Tuslos*','WMJ*'] // Hebrew Alphabet not actually official, but added due to popular demand // Hebrew Alphabet not actually official, but added due to popular demand
    ]
});

DesignationSystem.periodicTable = new DesignationSystem({
    displayName: 'Periodic Table',
    suffix: DEPRESSION_LETTER,
    mainLists: [
        ["Hydrogen","Helium","Lithium","Beryllium","Boron","Carbon","Nitrogen","Oxygen","Fluorine","Neon","Sodium","Magnesium","Aluminium","Silicon","Phosphorus","Sulfur","Chlorine","Argon","Potassium","Calcium","Scandium","Titanium","Vanadium","Chromium","Manganese","Iron","Cobalt","Nickel","Copper","Zinc","Gallium","Germanium","Arsenic","Selenium","Bromine","Krypton","Rubidium","Strontium","Yttrium","Zirconium","Niobium","Molybdenum","Technetium","Ruthenium","Rhodium","Palladium","Silver","Cadmium","Indium","Tin","Antimony","Tellurium","Iodine","Xenon","Caesium","Barium","Lanthanum","Cerium","Praseodymium","Neodymium","Promethium","Samarium","Europium","Gadolinium","Terbium","Dysprosium","Holmium","Erbium","Thulium","Ytterbium","Lutetium","Hafnium","Tantalum","Tungsten","Rhenium","Osmium","Iridium","Platinum","Gold","Mercury","Thallium","Lead","Bismuth","Polonium","Astatine","Radon","Francium","Radium","Actinium","Thorium","Protactinium","Uranium","Neptunium","Plutonium","Americium","Curium","Berkelium","Californium","Einsteinium","Fermium","Mendelevium","Nobelium","Lawrencium","Rutherfordium","Dubnium","Seaborgium","Bohrium","Hassium","Meitnerium","Darmstadtium","Roentgenium","Copernicium","Nihonium","Flerovium","Moscovium","Livermorium","Tennessine","Oganesson"]
    ]
});

DesignationSystem.periodicTableAnnual = DesignationSystem.periodicTable.clone();
DesignationSystem.periodicTableAnnual.naming.annual = true;
DesignationSystem.periodicTableAnnual.displayName = 'Periodic Table (Annual)';

DesignationSystem.presetDesignationSystems = [
    DesignationSystem.atlantic,
    DesignationSystem.easternPacific,
    DesignationSystem.centralPacific,
    DesignationSystem.westernPacific,
    DesignationSystem.westernPacific1979,
    DesignationSystem.westernPacific1989,
    DesignationSystem.westernPacific1996,
    DesignationSystem.westernPacific2000,
    DesignationSystem.PAGASA,
    DesignationSystem.PAGASA1963,
    DesignationSystem.PAGASA2001,
    DesignationSystem.northIndianOcean,
    DesignationSystem.australianRegionBoM,
    DesignationSystem.southPacific,
    DesignationSystem.southWestIndianOcean,
    DesignationSystem.southAtlantic,
    DesignationSystem.australianRegionJakarta,
    DesignationSystem.australianRegionPortMoresby,
    DesignationSystem.atlantic1979,
    DesignationSystem.periodicTable,
    DesignationSystem.periodicTableAnnual
];

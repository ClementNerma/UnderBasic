
"use strict";

var libErr = {
    _: 'Failed to load library',
    404: 'Library not found',
    403: 'Forbidden access for library file',
    500: 'Internal server error. Please try again in a few minutes'
};

var libraries = {};
var keyWords = ['function'];

var UnderBasic = new (function() {

    var _langs = {}, _lang = 'en';

    this.translate = function(str) {
        if(!_langs.hasOwnProperty(_lang))
            return str;

        return _langs[_lang][str] || str;
    };

    this.translation = function(lang) {
        if(!_langs.hasOwnProperty(lang)) {
            var req = $.ajax({
                method: 'GET',
                cache: false,
                url: 'lang/' + lang + '.tpk',
                timeout: 10000,
                dataType: 'text',
                async: false
            });

            if(req.status !== 200) {
                console.error('Failed to load translation pack "' + lang + '" : ' + libErr[req.status]);
                return false;
            }

            _langs[lang] = JSON.parse(req.responseText);
        }

        _lang = lang;
        console.info('"' + lang + '" language set');
        return true;
    }

    this.type = function(content, extended, celtic3) {

        var v = this.variable(content, extended, celtic3);

        if(v)
            return v;

        if(content.match(/^([0-9\.\+\-\*\/\(\)\!]+)$/))
            return 'number';

        if(content.match(/^"(.*)"$/))
            return 'string';

        if(content.match(/^{(.*)}$/))
            return 'list';

    };

    this.variable = function(varname, extended, celtic3) {

        if(varname.match(/^Str([0-9])$/))
            return 'string';

        if(varname.match(/^[A-Z]$/))
            return 'number';

        if(varname.match(/^List([A-Z]){1,6}$/))
            return 'list';

        if(varname.match(/^\[([A-Z])\]$/))
            return 'matrix';

        if(varname.match(/^Y[0-9]$/))
            return 'yvar';

        if(varname.match(/^Pic[0-9]$/))
            return 'picture';

        if(varname.match(/^GDB[0-9]$/))
            return 'GDB';

        if(!extended)
            return false;

        if(varname.match(/^prgm([A-Z]{1,8})$/))
            return 'program';

        if(!celtic3)
            return false;

        if(varname.match(/^appv([A-Z]{1,8})$/))
            return 'appvar';

        if(varname.match(/^group([A-Z]{1,8})$/))
            return 'group';

        if(varname.match(/^app([A-Za-z0-9]{1,8})$/))
            return 'application';

    };

    this.compile = function(code) {

        var started = (new Date()).getTime();

        var lines = code.split('\n'),
            match, line,
            alias = {}, functions = {};

        code = code
            .replace(/([^\\])\/\*(.*)\*\//mg, '$1')
            .replace(/([^\\])\/\/(.*)$/mg, '$1');

        code = code.replace(/#library( *)([a-zA-Z0-9_]+)/g, function(match, a, lib) {
            if(!libraries.hasOwnProperty(lib)) {
                var req = $.ajax({
                    method: 'GET',
                    cache: false,
                    url: 'libs/' + lib + '.ubl',
                    timeout: 10000,
                    dataType: 'text',
                    async: false
                });

                if(req.status !== 200)
                    return '\n#&' + tr('Failed to load library') + ' "' + lib + '" : ' + tr(libErr[req.status]) + '&#\n';

                libraries[lib] = req.responseText;
            }

            return libraries[lib];
        });

        for(var i = 0; i < lines.length; i += 1) {
            line = lines[i];

            if(match = line.match(/^(#def|#define|#alias|)( *)([a-zA-Z0-9_]+)( *):( *)([a-zA-Z0-9_]+)$/)) {
                alias[match[3]] = match[6];
                code = code.replace(new RegExp('(\\b)' + escapeRegExp(match[3]) + '(\\b)', 'g'), match[6]);
            }
        }

        code = code
            .replace(/^(.*)$/mg, function(match, content) { return content.trim(); })
            .replace(/^(#def|#define|#alias|)( *)([a-zA-Z0-9_]+)( *):( *)([a-zA-Z0-9_]+)$/mg, '')
            .replace(/^([a-zA-Z0-9]+)( *)\(( *)(.*)( *)\)$/mg, function(match, func, a, b, args) {
                if(keyWords.indexOf(func.toLocaleLowerCase()) !== -1)
                    return match;

                return func + ' ' + args;
            });

        code  = code
            .replace(/(^|\n)function( *)([a-zA-Z0-9_]+)( *)\(([a-zA-Z0-9_, \*]*)\)( *){\n((.|\n)*?)\n}(\n|$)/g, function(match, a, b, name, c, argsS, d, content) {

                if(functions.hasOwnProperty(name))
                    return '\n#&' + tr('Can\'t redeclare function') + ' "' + name + '"&#\n';

                if(typeof functions[name] !== 'undefined')
                    return '\n#&"' + name + '" ' + tr('is an object-reserved keyword') + '&#\n';

                if(keyWords.indexOf(name) !== -1)
                    return '\n#&"' + name + '" ' + tr('is a reserved keyword') + '&#\n';

                if(UnderBasic.variable(name))
                    return '\n#&"' + name + '" ' + tr('is a variable-reserved name') + '&#\n';

                var args = [], arg, m;
                argsS = argsS.trim().match(/("[^"]+"|[^,]+)/g) || [];

                for(var i = 0; i < argsS.length; i += 1) {
                    arg = argsS[i].trim();

                    m = arg.match(/^(string|number|list|matrix|yvar|picture|GDB|program|appvar|group|application|)( *)(\*|)([a-zA-Z0-9_]+)$/);

                    args.push({
                        type   : m[1] || false,
                        pointer: m[3] || false,
                        name   : m[4]
                    });

                }

                functions[name] = {
                    args: args,
                    content: content.trim()
                };

                return '';
            });

        for(var i in functions) {
            if(functions.hasOwnProperty(i)) {
                code = code.replace(new RegExp('^' + i + '( ){1,}(.*?)$', 'mg'), function(match, a, argsS) {
                        argsS = argsS.trim().match(/("[^"]+"|[^,]+)/g) || [];

                        if(argsS.length !== functions[i].args.length)
                            return '\n#&' + tr('Bad number of arguments for function') + ' ' + i + ' : ' + functions[i].args.length + ' ' + tr('required, but') + ' ' + argsS.length + ' ' + tr('specified') + '&#\n';

                        var args = {}, e;

                        for(var j = 0; j < functions[i].args.length; j += 1) {
                            e = functions[i].args[j];

                            if(!argsS[j])
                                return '\n#&' + tr('Missing argument') + ' ' + e.name + ' ' + tr('for function') + ' ' + i;

                            args[e.name] = argsS[j].replace(/([^"]+)|("(?:[^"\\]|\\.)+")/g, function($0, $1, $2) {
                                return $1 ? $1.replace(/\s/g, '') : $2;
                            });

                            if(e.pointer && !UnderBasic.variable(args[e.name], true))
                                return '\n#&' + tr('Invalid argument') + ' [' + i + ':' + e.name + '] : ' + tr('Must be a pointer') + '&#\n';

                            if(e.type && UnderBasic.type(args[e.name], true) !== e.type)
                                return '\n#&' + tr('Invalid argument') + ' [' + i + ':' + e.name + '] : ' + tr('Must be a') + ' ' + tr(e.type) + ', ' + tr(UnderBasic.type(args[e.name], true) || 'unknown') + ' ' + tr('specified') + '&#\n';
                        }

                        return functions[i].content.replace(/([^\\])\{\{([a-zA-Z0-9_]+)\}\}/g, function(match, pre, varname) {
                            varname = varname.trim();
                            return args[varname] ? pre + args[varname] : match;
                        });
                    });
            }
        }

        var description = code.match(/(^|\n)#description( *)(.{1,16})(\n|$)/);
        var icon        = code.match(/(^|\n)#icon( *)([A-Z0-9]{16})(\n|$)/);

        if(icon)
            code = ':' + icon[3] + '\n' + code;

        if(description)
            code = ':"' + description[3] + '\n' + code;

        code = code
            .replace(/^\\( *)(.*)$/mg, '$2')
            .replace(/^\n{1,}/g, '')
            .replace(/\n{1,}$/g, '');

        while(code.match(/\n\n/))
            code = code.replace(/\n\n/g, '\n');

        match = code.match(/(^|\n)#&(.*)&#(\n|$)/gm);
        var err;

        if(match) {
            err = tr('Compilation aborted') + ' :';
            for(var i = 0; i < match.length; i += 1)
                err += '\n    ' + match[i].match(/(^|\n)#&(.*)&#(\n|$)/)[2];
        }

        return {
            content: err || code,
            duration: (new Date()).getTime() - started,
            failed: !!err
        };

    };

});

var tr = UnderBasic.translate;
var langs = {};

var language = 'fr';

UnderBasic.translation(navigator.userLanguage || navigator.language || 'en');

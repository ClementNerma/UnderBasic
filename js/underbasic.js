
"use strict";

/**
  * Escape a regex
  * @param {string} str
  * @return {string}
  */
function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

var libErr = {
    _  : 'Failed to load library',
    404: 'Library not found',
    403: 'Forbidden access to library file',
    500: 'Internal server error. Please try again in a few minutes'
};

var libraries = {};
var keyWords = ['function', 'ret'];

/**
  * UnderBasic compiler
  * @type {function}
  */
var UnderBasic = new (function() {

    var _langs = {}, _lang = 'en';

    /**
      * Translate a message
      * @param {string} str
      * @param {object} values
      * @param {object} [obj] String sub-object location
      */
    this.translate = function(str, values, obj) {
      var i  = -1; values = values || {};

      if(!_langs.hasOwnProperty(_lang))
        return str;

      if(obj && !_langs[_lang].hasOwnProperty(obj))
        return str;

      return (!obj ? (_langs[_lang][str] || str || '') : (_langs[_lang][obj][str] || str || ''))
        .replace(/\$\{(.*?)\}/g, function(match, content) {
          //return parameters.hasOwnProperty(content) ? pre + parameters[content] : pre + content;

          if(!Array.isArray(values)) {
            if(values.hasOwnProperty(content))
              return values[content];
          } else if(values.length > ++i)
            return values[i];
          else
            return match;
        });
    };

    /**
      * Load a translation package
      * @param {string} lang
      * @return {boolean} True if success
      */
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

    /**
      * Get type of a content
      * @param {string} content
      * @param {boolean} [extended] Includes programs + Celtic3 types
      * @param {boolean} [celtic3] Includes AppVar + Groups + Applications
      * @return {string}
      */
    this.type = function(content, extended, celtic3) {

        var v = this.variable(content, extended, celtic3);

        if(v)
            return v;

        if(content.match(/^([0-9\.\+\-\*\/\(\)\!\[\]A-Z]+)$/))
            return 'number';

        if(content.match(/^"(.*)"$/))
            return 'string';

        if(content.match(/^{(.*)}$/))
            return 'list';

        if(content.match(/^\[([0-9,\[\]A-Z\*\+\-\/\.]+)\]$/))
            return 'matrix';
    };

    /**
      * Get type of a variable using its name
      * @param {string} varname Name of the variable
      * @param {boolean} [extended] Includes programs + Celtic3 types
      * @param {boolean} [celtic3] Includes AppVar + Groups + Applications
      * @return {string}
      */
    this.variable = function(varname, extended, celtic3) {

        if(varname.match(/^Str([0-9])$/))
            return 'string';

        if(varname.match(/^[A-Z]$/))
            return 'number';

        if(varname.match(/^L([A-Z]){1,6}$/))
            return 'list';

        if(varname.match(/^L([A-Z]){1,6}\[([A-Z0-9]+)\]$/))
            return 'number';

        if(varname.match(/^\[([A-Z])\]$/))
            return 'matrix';

        if(varname.match(/^\[([A-Z])\]\(([A-Z0-9]+),([A-Z0-9]+)\)$/))
            return 'number';

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

    /**
      * Compile an UnderBasic code to TI-Basic z80 code
      * @param {string} code
      * @param {object} [options]
      * @return {object}
      */
    this.compile = function(code, options) {

        /**
          * Throw an error
          * @param {string} err
          * @return {string} To use in .replace()
          */
        function error(err) {
          // Here, content gives 'undefined'
          errors.push({ message: err, line : lineIndex - substractErrorLine, content: line /*lines[lineIndex].trim()*/, file: file });
          return '';
        }

        /**
          * Format a string with vars and filters
          * @param {string} input
          * @param {object} vars
          * @return {string} output
          */
        function format(input, vars) {
          // support of explicit variables calls
          // ex: ${name}
          input = input.replace(/\${ *([a-zA-Z0-9_]+) *}/g, function(match, name) {
            if(!vars.hasOwnProperty(name)) {
              return error(tr('Variable "${name}" is not defined', [name]));
            } else
              return vars[name];
          });

          // support of explicit variables calls with filter
          // ex: ${name|unquote}
          // LIST of filters : unquote, uppercase, lowercase, ucfirst, lcfirst
          input = input.replace(/\${ *([a-zA-Z0-9_]+) *\| *([a-zA-Z0-9_]+) *}/g, function(match, name, filter) {
            if(!vars.hasOwnProperty(name))
              return error(tr('Argument "${name}" is not defined', [name]));
            else if(filter === 'unquote') {
              if(vars[name].substr(0, 1) !== '"' || vars[name].substr(-1) !== '"')
                error(tr('Failed to apply filter "unquote" : Variable "${name}" is not quoted', [name]));
              else
                return vars[name].substr(1, vars[name].length - 2);
            } else if(filter === 'uppercase')
              return vars[name].toLocaleUpperCase();
            else if(filter === 'lowercase')
              return vars[name].toLocaleLowerCase();
            else if(filter === 'ucfirst')
              return vars[name].substr(0, 1).toLocaleUpperCase() + vars[name].substr(1);
            else if(filter === 'lcfirst')
              return vars[name].substr(0, 1).toLocaleLowerCase() + vars[name].substr(1);
            else
              error(tr('Filter "${filter}" doesn\'t exist', [filter]));
          });

          // Make #define effects in the code
          // : Replace all string aliases
          // ex: "Hello ${name}"
          var aliases = Object.keys(vars);

          for(l = 0; l < aliases.length; l++) {
            //code = code.replace(new RegExp('([^{\\\\]){' + escapeRegExp(i) + '}', 'g'), '$1' + alias[i]);
            input = input.replace(new RegExp('("[^"]*"|\'[^\']*\')|\\b' + escapeRegExp(aliases[l]) + '\\b', 'g'), function(match, name) {
              return (name === undefined ? vars[aliases[l]] : name);
            });
          }

          return input;
        }

        var started = (new Date()).getTime();
        var notices = [], errors = [];
        // List of libs included by the code
        var includedLibs = [];

        options = options || {};

        // Support of multiple lines comments
        code = code.replace(/###((.|\n)*?)###/g, '').replace(/\/\*((.|\n)*?)\*\//g, '');
        // Prevent code from JS injection
        code = code.replace(/(^|\n) *#script *\n((.|\n)*?) *#endscript *(\n|$)/g, '$1$3');

        var lines = code.split('\n'), lineIndex, funcnames, define, ret, e, varName, value, varType, accLevel = 0,
            match, line, req, action, lib, $1, returnVar, block, regExp1, regExp2, aliases, valType, substractErrorLine = 0,
            alias = {}, functions = {}, tempVars = {}, out = [], syntaxError, realArgs, k, l, tmp, checkFunctions,
            type, name, argsS, ob_buffer = [], args, arg, m, j, file = 'program', put, arg_name, arg_word;

        for(var i = 0; i < lines.length; i++) {
          lineIndex = i;
          line = lines[i];
          // Support of comments
          //  /* ... */
          //  // ...
          //  #  ...
          line = line
            .replace(/\/\*(.*?)\*\//, '')
            .replace(/\/\/(.*?)$/, '')
            .replace(/# (.*?)$/, '')
            .trim();

          if(!line) continue ;

          if(line.substr(0, 1) === '\\') {
            if(ob_buffer)
              ob_buffer.push(line);
            else
              out.push(line.substr(1));

            continue ;
          }

          if(action !== 'DEFINE_FUNCTION' && action !== 'CALL_BLOCK' && line.substr(0, 1) !== '#')
            line = format(line, alias);

          if(line.substr(-1) === '{')
            accLevel += 1;

          if(line === '}') {
            if(accLevel) accLevel -= 1;
            if(accLevel) { ob_buffer.push('}'); continue ; };

            if(!action)
              error(tr('Syntax error : No closing bracket is needed here'));
            else if(action === 'DEFINE_FUNCTION') {
              // Reference the function
              functions[define.name] = {
                  args   : define.args,
                  content: ob_buffer.join('\n'),
                  block  : (define.type === 'block')
              };

              ob_buffer = null; action = null; define = null;
            } else if(action === 'CALL_BLOCK') {
              define.args._CONTENT_ = ob_buffer.join('\n');
              lines.splice.apply(lines, [i + 1, 0].concat(format(define.ret, define.args).split('\n')));

              ob_buffer = null; action = null; define = null;
            } else
              error('Compiler error : Unknown closing action "${action}"', [action]);

            continue ;
          }

          if(action === 'DEFINE_FUNCTION' || action === 'CALL_BLOCK') {
            ob_buffer.push(line);
            continue ;
          }

          checkFunctions = false;

          // Support of lists indexes
          line = line.replace(/([^a-zA-Z])L([A-Z]+)\[(.+?)\]/g, '$1L$2($3)');
          // Support of matrix indexes
          line = line.replace(/\[([A-Z])\]\[(.+?),(.+?)\]/g, '[$1]($2,$3)');

          // support of functions call with parenthesis
          if(match = line.match(/^([a-zA-Z0-9_]+) *\( *(.*) *\) *(|{)$/)) {
            if(keyWords.indexOf(match[1].toLocaleLowerCase()) === -1)
              line = match[1] + ' ' + match[2] + (match[3] || '');
          }

          // #include directive
          if(match = line.match(/^(#|)include *([a-zA-Z0-9_\-,\.]+)$/)) {
            file = match[2];

            if(!options.files || !options.files.hasOwnProperty(file))
              error(tr('Can\'t include file "${file}" : File not found', [file]));
            else
              lines.splice.apply(lines, [i + 1, 0].concat(['#file ' + file]).concat(((!options.preventJavaScriptFromIncludeFiles || !options.preventJavaScript) ? files[file] : files[file].replace(/(^|\n) *#script *\n((.|\n)*?) *#endscript *(\n|$)/g, '$1$3')).split('\n')).concat(['#endfile']));
          } else
          // #library directive
          if(match = line.match(/^(#|)(library|import) *([a-zA-Z0-9\-_]+)$/)) {
            lib = match[3];
            // If library has already been included
            if(includedLibs.indexOf(lib) !== -1)
              notices.push('Library "' + lib + '" has been already loaded');
            else {
              // Else, download it
              if(!libraries.hasOwnProperty(lib)) {
                req = $.ajax({
                    method: 'GET',
                    cache: false,
                    url: 'libs/' + lib + '.ubl',
                    timeout: 10000,
                    dataType: 'text',
                    async: false
                });

                // If fail to fetch server
                if(req.status !== 200)
                    error(tr('Failed to load library "${lib}" : ${status}', [lib, tr(libErr[req.status])]));
                else
                  // Save the library
                  libraries[lib] = req.responseText;
              }

              if(libraries[lib]) {
                // Append to the main code
                lines.splice.apply(lines, [i + 1, 0].concat(['#file library.' + lib]).concat(libraries[lib].split('\n').concat(['#endfile'])));
                // Reference the library as used
                includedLibs.push(lib);
              }
            }
          } else
          // function or block declaration
          if(match = line.match(/^(function|block) *([a-zA-Z0-9_]+) *\(([a-zA-Z0-9_, =\*\[\]"]*)\) *{$/)) {
            type = match[1]; name = match[2]; argsS = match[3];

            /*name = options.localize ? (options.localizeCamelCase ? tr(name, {}, 'functions').replace(/([a-z])([A-Z])/g, function(match, min, maj) {
              return min + '_' + maj.toLocaleLowerCase();
            }) : tr(name, {}, 'functions')) : name;*/
            name = options.localize ? tr(name, {}, 'functions') : name;

            if(functions.hasOwnProperty(name))
              error(tr('Can\'t redeclare function "${name}"', [name]));
            else if(typeof functions[name] !== 'undefined')
              error(tr('"${name}" is an object-reserved keyword', [name]));
            else if(keyWords.indexOf(name) !== -1)
              error(tr('"${name}" is a reserved keyword', [name]));
            else if(UnderBasic.variable(name))
              error(tr('"${name}" is a variable-reserved name', [name]));
            else {
              args = []; argsS = argsS.trim().match(/("[^"]+"|[^,]+)/g) || [];
              // For each argument...
              for(j = 0; j < argsS.length; j += 1) {
                arg = argsS[j].trim(); put = [];

                if(arg.indexOf(' ') === -1) {
                  args.push({ type: 'unref_mixed', pointer: false, optionnal: false, name: arg });
                  continue ;
                }

                arg_word = arg.split(' ')[0];
                arg_name = arg.split(' ')[1];

                if(arg_word.substr(-1) === '*') {
                  put.pointer = true;
                  put.type    = arg_word.substr(0, arg_word.length - 1);
                } else
                  put.type    = arg_word;

                if((arg_name.substr(0, 1) === '[' ? 1 : 0) + (arg_name.substr(-1) === ']' ? 1 : 0) === 1)
                  error(tr('Bad function declaration : argument ${index} is defined as optionnal argument but missing closing bracket', [j + 1]));

                if(arg_name.substr(0, 1) === '[') {
                  put.optionnal = true;
                  put.name      = arg_name.substr(1, arg_name.length - 2);
                } else
                  put.name      = arg_name;

                if(arg.indexOf('=') !== -1) {
                  if(!arg.substr(arg.indexOf('=') + 1).trim().length)
                    error(tr('Bad function declaration : argument ${index} has "=" operator but no default value was specified', [j + 1]));

                  put.byDefault = arg.substr(arg.indexOf('=') + 1).trim();
                }

                if((['string', 'number', 'list', 'matrix', 'yvar', 'picture', 'GDB', 'program', 'appvar', 'group', 'application', 'mixed', 'unref_mixed']).indexOf(put.type) === -1)
                  error(tr('Bad function declaration : argument ${index} is declared as WRONG type `${type}`', [j + 1, put.type]))

                args.push(put);
              }

              ob_buffer = [];
              define    = { name: name, args: args, type: type };
              action    = 'DEFINE_FUNCTION';
            }
          } else
          // #define, #def, #alias directives
          if(match = line.match(/^(#def|#define|#alias|) *([a-zA-Z0-9_]+) *: *(.+)$/)) {
            if(keyWords.indexOf(match[1]) !== -1)
              return error(tr('Alias "${name}" mustn\'t be a reserved keyword', [match[2]]));

            if(UnderBasic.type(match[2], true, true))
              return error(tr('Alias "${name}" mustn\'t be variable name or a plain value', [match[2]]));

            if(functions.hasOwnProperty(match[2]))
              return error(tr('Alias "${name}" mustn\'t be a function name', [match[2]]));

            alias[match[2]] = match[3];
          } else
          // #file directive marker
          if(match = line.match(/^#file +([a-zA-Z0-9_ \.:\\\/\-]+)$/)) {
            file = match[1]; substractErrorLine = i - 1;
          } else
          // #endfile directive marker
          if(line === '#endfile') {
            file = 'program'; substractErrorLine = i;
          } else
          // variables assignement using a function
          if(match = line.match(/^([A-Za-z0-9\[\]\(\)]+) *= *([a-zA-Z0-9_]+) *\( *(.*) *\)$/)) {
            checkFunctions = true;
            line = match[2] + ' ' + match[3] + '|->' + match[1];
          } else
          // variables assignement
          if(match = line.match(/^([A-Za-z0-9\[\]\(\)]+) *= *(.*?)$/)) {
            varName = match[1]; value = match[2].replace(/([^"]+)|("(?:[^"\\]|\\.)+")/g, function($0, $1, $2) {
              return $1 ? $1.replace(/\s/g, '') : $2;
            });

            if(options.checkVariablesValidName)
              if(!UnderBasic.variable(varName, true, true))
                return error(tr('Bad variable name : "${name}"', {name:varName}));

            if(options.checkAssignments) {
              varType = tr(UnderBasic.variable(varName));
              valType = tr(UnderBasic.type(value, true, true));

              if((varType && valType) || !options.ignoreUndefinedAssignment) {
                if(!varType)
                  error(tr('Bad variable assignment : "${name}" is not a valid variable name', {name:varName}));
                else if(!valType)
                  error(tr('Bad variable assignment : ${value} is not a valid value', {value:value}));
                else if(varType !== valType)
                  error(tr('Bad variable assignment : "${name}"\'s type is ${varType} but assigned value\'s type is ${valType}', {name:varName,varType:varType,valType:valType}));
              } else if(!options.ignoreUndefinedAssignment)
                notices.push('Assignment checker was enabled but an assignment was ignored : ' + (!varType ? 'variable' : 'value') + ' type is unknown');
            }

            (ob_buffer || out).push(value + '->' + varName);
          } else
            checkFunctions = true;

          if(checkFunctions) {
            // function/block calls
            funcnames   = Object.keys(functions);
            syntaxError = true;

            for(j = 0, name; j < funcnames.length; j++) {
              name   = funcnames[j];
              block  = !!functions[funcnames[j]].block;
              // Regex | ex: 'display nom'
              regExp1 = new RegExp('^' + name + ' +(.*?)(\\|\\->([a-zA-Z0-9\\[\\]\\(\\)]+)|)$');
              regExp2 = new RegExp('^' + name + ' +(.*?) *{$');

              if(code.match(block ? regExp1 : regExp2)) {
                error(tr('Can\'t use "${name}" as a ' + (block ? 'function' : 'block'), [name]));
                continue ;
              } else // Improve condition speed (a little ^^)
              if(match = line.match(block ? regExp2 : regExp1)) {
                syntaxError = false;
                $1 = match[1];
                returnVar = match[3];

                realArgs = []; args = {};

                //argsS = $1.trim().match(/("[^"]+"|[^,]+)/g) || [];
                argsS = $1.trim().split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

                // For each argument of the function
                for(k = 0; k < functions[name].args.length; k += 1) {
                  e = functions[name].args[k];

                  // Check if argument is missing
                  if(!argsS[k]) {
                    // Check if argument is needed
                    if(!e.optionnal) {
                      error(tr('Missing argument "${name}" (${type}) for function "${func}"', [e.name, tr(e.type), name]));
                      continue ;
                    }

                    args[e.name] = e.byDefault || '';
                  } else {
                    realArgs.push(e.name);
                    args[e.name] = argsS[k].trim();

                    if(e.pointer && !UnderBasic.variable(args[e.name], true)) {
                      error(tr('Invalid argument [${func} : ${name}] : Must be a pointer', [name, e.name]));
                      continue ;
                    }

                    if((tmp = UnderBasic.type(args[e.name], true)) !== e.type) {
                      if(e.type === 'mixed' && tmp)
                        continue ;

                      if(e.type === 'unref_mixed')
                        continue ;

                      error(tr('Invalid argument [${func} : ${name}] : Must be a ${type}, ${specified} specified', {
                          func: name,
                          name: e.name,
                          type: tr(e.type),
                          specified: tr(UnderBasic.type(args[e.name], true) || 'unknown')
                      }));
                      continue ;
                    }

                    args[e.name] = argsS[k].replace(/([^"]+)|("(?:[^"\\]|\\.)+")/g, function($0, $1, $2) {
                      return $1 ? $1.replace(/\s/g, '') : $2;
                    });
                  }
                }

                ret = functions[name].content;

                if(returnVar) {
                  ret = ret.replace(/(^|\n) *return +(.*)(\n|$)/, function(match, str1, content, str2) {
                    return str1 + returnVar + ' = ' + content + str2;
                  });

                  args.ret = returnVar;
                }

                ret = ret
                  .replace(/#unquote *([a-zA-Z0-9_;]+)mg/g, function(match, names) {
                      names = names.split(';');

                      for(var i = 0; i < names.length; i += 1)
                          if(args[names[i]])
                              args[names[i]] = args[names[i]].replace(/^"(.*)"$/, '$1');

                      return '';
                  })
                  .replace(/(^|\n)#ifdef *([a-zA-Z0-9_]+)\n((.|\n)*?)\n#endif(\n|$)/g, function(match, a, name, content) {
                      //return (realArgs.indexOf(name) !== -1) ? a + content + '\n' : a || '\n';
                      return args.hasOwnProperty(name) ? a + content + '\n' : a || '\n';
                  })
                  .replace(/(^|\n)#ifndef *([a-zA-Z0-9_]+)\n((.|\n)*?)\n#endif(\n|$)/g, function(match, a, name, content) {
                      //return (realArgs.indexOf(name) === -1) ? a + content + '\n' : a || '\n';
                      return args.hasOwnProperty(name) ? a || '\n' : a + content + '\n';
                  })
                  .replace(/^#set +([a-zA-Z0-9_]+) +(.*)$/mg, function(match, name, content) {
                    args[name] = content;
                    return '';
                  });

                if(tmp = ret.match(/^#script *\n((.|\n)*?)#endscript/)) {
                  try      { eval(tmp[1]); }
                  catch(e) { console.error(e); error(tr('JavaScript runtime error in function "${name}"', [name])); }
                  ret = ret.replace(/^#script *\n((.|\n)*?)#endscript/, '');
                }

                if(block) {
                  action    = 'CALL_BLOCK';
                  define    = { name: name, ret: ret, args: args };
                  ob_buffer = [];
                } else {
                  ret = format(ret, args);
                  lines.splice.apply(lines, [i + 1, 0].concat(ret.split('\n')));
                }

                //(ob_buffer || out).push(ret);
                syntaxError = false;
                break;
              }
            }

            if(syntaxError) {
              if(match = line.match(/^([a-zA-Z0-9_]+) *(.*?){$/))
                error(tr('Block "${block}" is not defined', [match[1]]))
              else if(match = line.match(/^([a-zA-Z0-9_]+) +(.*?)$/))
                error(tr('Function "${func}" is not defined', [match[1]]))
              else
                error(tr('Syntax error'));
            }
          }
        }

        if(errors.length) {
          out = [tr('Compilation aborted (${num} errors) :', [errors.length.toString()]), ''];

          for(i = 0; i < errors.length; i++) {
           out.push('  ' + errors[i].file + ':' + (errors[i].line + 1).toString() + ' ' + errors[i].message);
           out.push('  > ' + errors[i].content);

           if(i !== errors.length - 1) // Faster than a '<' comparator
            out.push('');
          }
        }

        return {
          content  : out.join('\n'),
          duration : (new Date()).getTime() - started,
          failed   : !!errors.length,
          notices  : notices,
          errors   : errors,
          aliases  : alias,
          functions: functions
        };
    }

});

var tr = UnderBasic.translate;
var langs = {};

var language = 'fr';

UnderBasic.translation(navigator.userLanguage || navigator.language || 'en');

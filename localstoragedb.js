/*
 * @autor Ricardo Sismeiro
 * @credits  Kailash Nadh (http://kailashnadh.name) 
 * 
 * @license http://www.gnu.org/licenses/gpl-3.0-standalone.html
 *
 */
(function(o){
    var _ = {

        db_id : null,
        db_prefix : null,
        db_new: false,
        db: null,

        /**
         * constructor
         */
        o: function(){
            if (typeof(localStorage)==="undefined") {
                _._error('Ups... localStorage not found!');
            }
            if (arguments.length>0){
                _._init(arguments[0]);
            }
            return _;
        },

        /**
         * initialization
         */
        _init : function(name){
            _.db_prefix = 'db_';
            _.db_id = _.db_prefix + _._vname(name);
            _.db_new = false;
            _.db = localStorage[_.db_id];
            if( !( _.db && (_.db = JSON.parse(_.db)) && _.db.tables && _.db.data ) ) {
                _.db = {
                    tables: {},
                    data: {}
                };
                _._commit();
                _.db_new = true;
            }
        },

        _vname : function(name){            
            return name.replace(/[^a-z_0-9]/ig,'');
        },

        log : function(data){
            console.log(data);
        },

        /**
         * throw an error
         * @access private
         */
        _error: function(msg) {
            throw new Error(msg);
        },

        /**
         * drop the database
         * @access private
         */
        _drop : function(){
            delete localStorage[_.db_id];
            _.db = null;
        },

        /**
         * number of tables in the database
         * @access private
         * @return int
         */
        _tableCount : function(){
            var count = 0;
            for(var table in _.db.tables) {
                count++;
            }
            return count;
        },

        /**
         * check whether a table exists
         * @access private
         * @return bool
         */
        _tableExists : function (tableName){
            return _.db.tables[tableName] ? true : false;
        },

        /**
         * check whether a table exists, and if not, throw an error
         * @access private
         */
        _tableExistsWarn : function (tableName){
            if(!_._tableExists(tableName)) {
                _._error("The table '" + tableName + "' does not exist.");
            }
        },

        /**
         * create a table
         * @access private
         */
        _createTable : function (tableName, fields) {
            _.db.tables[tableName] = {
                fields: fields,
                auto_increment: 1
            };
            _.db.data[tableName] = {};
            _._commit();
        },

        /**
         * drop a table
         * @access private
         */
        _dropTable : function(tableName) {
            delete _.db.tables[tableName];
            delete _.db.data[tableName];
            _._commit();
        },

        /**
         * empty a table
         * @access private
         */
        _truncate : function (tableName) {
            _.db.tables[tableName].auto_increment = 1;
            _.db.data[tableName] = {};
            _._commit();
        },

        /**
         * number of rows in a table
         * @access private
         * @return int
         */
        _rowCount : function (tableName) {
            var count = 0;
            for(var ID in _.db.data[tableName]) {
                count++;
            }
            return count;
        },

        /**
         * insert a new row
         * @access private
         */
        _insert : function (tableName, data) {
            data.ID = _.db.tables[tableName].auto_increment;
            _.db.data[tableName][ _.db.tables[tableName].auto_increment ] = data;
            _.db.tables[tableName].auto_increment++;
            _._commit();
            return data.ID;
        },

        /**
         * select rows, given a list of IDs of rows in a table
         * @access private
         */
        _select : function(tableName, ids) {
            var ID = null, results = [], row = null;
            for(var i in ids) {
                ID = ids[i];
                row = _.db.data[tableName][ID];
                results.push( _._clone(row));
            }
            return results;
        },

        /**
         * select rows in a table by field-value pairs, returns the IDs of matches
         * @access private
         */
        _queryByValues : function(tableName, data, limit) {
            var result_ids = [],
            exists = false,
            row = null;
            for(var ID in _.db.data[tableName]) {                               //loop through all the records in the table, looking for matches
                row = _.db.data[tableName][ID];
                exists = false;
                for(var field in data) {
                    if(typeof data[field] == 'string') {	                //if the field is a string, do a case insensitive comparison
                        if( row[field].toString().toLowerCase() == data[field].toString().toLowerCase() ) {
                            exists = true;
                            break;
                        }
                    } else {
                        if( row[field] == data[field] ) {
                            exists = true;
                            break;
                        }
                    }
                }
                if(exists) {
                    result_ids.push(ID);
                }
                if(result_ids.length == limit) {
                    break;
                }
            }
            return result_ids;
        },

        /**
         * select rows in a table by a function, returns the IDs of matches
         * @access private
         */
        _queryByFunction : function (tableName, queryFunction, limit) {
            var result_ids = [],
            row = null;
            for(var ID in _.db.data[tableName]) {                               //loop through all the records in the table, looking for matches
                row = _.db.data[tableName][ID];
                if( queryFunction( _._clone(row) ) == true ) {	                //it's a match if the supplied conditional function is satisfied
                    result_ids.push(ID);
                }
                if(result_ids.length == limit) {
                    break;
                }
            }
            return result_ids;
        },

        /**
         * return all the IDs in a table
         * @access private
         */
        _getIDs : function (tableName, limit) {
            var result_ids = [];
            for(var ID in _.db.data[tableName]){
                result_ids.push(ID);
                if(result_ids.length == limit){
                    break;
                }
            }
            return result_ids;
        },

        /**
         * delete rows, given a list of their IDs in a table
         * @access private
         */
        _deleteRows : function (tableName, ids) {
            for(var i in ids) {
                delete _.db.data[tableName][ ids[i] ];
            }
            _._commit();
            return ids.length;
        },

        /**
         * update rows
         * @access private
         */
        _update : function(tableName, ids, updateFunction) {
            var ID = '', num = 0;

            for(var i in ids) {
                ID = ids[i];

                var updatedData = updateFunction( _._clone(_.db.data[tableName][ID]) );

                if(updatedData) {
                    delete updatedData['ID'];                                   // no updates possible to ID
                    var newData = _.db.data[tableName][ID];
                    for(var field in updatedData) {                             // merge updated data with existing data
                        newData[field] = updatedData[field];
                    }

                    _.db.data[tableName][ID] = _._validFields(tableName, newData);
                    num++;
                }
            }
            if (num>0){
                _._commit();
            }
            return num;
        },

        /**
         * commit the database to localStorage
         * @access private
         */
        _commit : function() {
            try {
                localStorage.setItem(_.db_id,JSON.stringify(_.db));
            } catch (e) {
                _._error()
            }
        },

        /**
         * serialize the database
         * @access private
         */
        _serialize : function () {
            return JSON.stringify(_.db);
        },

        /**
         * clone an object
         * @access private
         */
        _clone : function (obj) {
            var new_obj = {};
            for(var key in obj) {
                new_obj[key] = obj[key];
            }
            return new_obj;
        },

        /**
         * given a data list, only retain valid fields in a table
         * @access private
         */
        _validFields : function (tableName, data) {
            var field = '', newData = {};
            for(var i in _.db.tables[tableName].fields) {
                field = _.db.tables[tableName].fields[i];
                if(data[field]) {
                    newData[field] = data[field];
                }
            }
            return newData;
        },

        /**
         * given a data list, populate with valid field names of a table
         * @access private
         */
        _validateData : function (tableName, data) {
            var field = '', newData = {};
            for(var i in _.db.tables[tableName].fields) {
                field = _.db.tables[tableName].fields[i];
                newData[field] = data[field] ? data[field] : null;
            }
            return newData;
        },

        /**
         * commit the database to localStorage
         * @access public
         */
        commit: function() {
            _._commit()
        },

        /**
         * is this instance a newly created database?
         * @access public
         */
        isNew: function() {
            return _.db_new;
        },

        /**
         * delete the database
         * @access public
         */
        drop: function() {
            _._drop();
        },

        /**
         * serialize the database
         * @access public
         */
        serialize: function() {
            return _._serialize();
        },

        /**
         * check whether a table exists
         * @access public
         */
        tableExists: function(tableName) {
            return _._tableExists(tableName);
        },

        /**
         * number of tables in the database
         * @access public
         */
        tableCount: function() {
            return _._tableCount();
        },

        /**
         * create a table
         * @access public
         */
        createTable: function(tableName, fields) {
            var result = false;
            if(_.tableExists(tableName)) {
                _._error("The table name '" + tableName + "' already exists.");
            } else {
                // cannot use indexOf due to <IE9 incompatibility
                // de-duplicate the field list
                var fields_literal = {};
                for(var i in fields) {
                    fields_literal[ fields[i] ] = true;
                }
                delete fields_literal['ID'];                                    // ID is a reserved field name

                fields = ['ID'];
                for(var field in fields_literal) {
                    fields.push(field);
                }
                _._createTable(tableName, fields);
                result = true;
            }

            return result;
        },

        /**
         * drop a table
         * @access public
         */
        dropTable: function(tableName) {
            _._tableExistsWarn(tableName);
            _._dropTable(tableName);
        },

        /**
         * empty a table
         * @access public
         */
        truncate: function(tableName) {
            _._tableExistsWarn(tableName);
            _._truncate(tableName);
        },

        /**
         * number of rows in a table
         * @access public
         */
        rowCount: function(tableName) {
            _._tableExistsWarn(tableName);
            return _._rowCount(tableName);
        },

        /**
         * insert a row
         * @access public
         */
        insert: function(tableName, data) {
            _._tableExistsWarn(tableName);
            return _._insert(tableName, _._validateData(tableName, data));
        },

        /**
         * update rows
         * @access public
         */
        update: function(tableName, query, updateFunction) {
            _._tableExistsWarn(tableName);
            var result_ids = [];
            if(!query) {
                result_ids = _._getIDs(tableName);				// there is no query. applies to all records
            } else if(typeof query == 'object') {				// the query has key-value pairs provided
                result_ids = _._queryByValues(tableName, _._validFields(tableName, query));
            } else if(typeof query == 'function') {				// the query has a conditional map function provided
                result_ids = _._queryByFunction(tableName, query);
            }
            return _._update(tableName, result_ids, updateFunction);
        },

        /**
         * select rows
         * @access public
         */
        query: function(tableName, query, limit) {
            _._tableExistsWarn(tableName);

            var result_ids = [];
            if(!query) {
                result_ids = _._getIDs(tableName, limit);                       // no conditions given, return all records
            } else if(typeof query == 'object') {                               // the query has key-value pairs provided
                result_ids = _._queryByValues(tableName, _._validFields(tableName, query), limit);
            } else if(typeof query == 'function') {                             // the query has a conditional map function provided
                result_ids = _._queryByFunction(tableName, query, limit);
            }
            return _._select(tableName, result_ids, limit);
        },

        /**
         * delete rows
         * @access public
         */
        deleteRows: function(tableName, query) {
            _._tableExistsWarn(tableName);
            var result_ids = [];
            if(!query) {
                result_ids = _._getIDs(tableName);
            } else if(typeof query == 'object') {
                result_ids = _._queryByValues(tableName, _._validFields(tableName, query));
            } else if(typeof query == 'function') {
                result_ids = _._queryByFunction(tableName, query);
            }
            return _._deleteRows(tableName, result_ids);
        }
    };
    /**
     * Export
     */
    o._=_.o;
})(window);
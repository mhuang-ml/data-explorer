'use strict';

angular.module('demoApp')
  .controller('AdhocWizardCtrl', function ($window,$scope, $http, $stateParams, $sce, $interval, databaseService, wizardService) {

    $scope.step = 1;
    $scope.wizardForm;
    $scope.wizardResults = '';
    $scope.queryView =  $stateParams.queryView;
    console.log("WHAT")
    console.log($scope.queryView)
    $scope.wizardTitle = $scope.queryView == "query" ? "Edit Query" : "Edit view for Query"
    $scope.viewTitle = $scope.queryView == "query" ? "Query search fields and default view" : "View information"
        $scope.loadQueryName = fromHex($stateParams.queryName);
    $scope.loadDocType = fromHex($stateParams.docType);
    $scope.loadViewName = fromHex($stateParams.viewName);
    $scope.editMode = $scope.loadQueryName != undefined && $scope.loadQueryName.length > 0 &&
                         $scope.loadDocType != undefined && $scope.loadDocType.length > 0;
    $scope.insertView = $scope.editMode && $scope.queryView == "view" && $scope.loadViewName.length == 0
    $scope.insertQuery = $scope.queryView == "query" && $scope.editMode == false
    $scope.buttonText = ($scope.insertView || $scope.insertQuery) ? "Insert" : "Update";
    $scope.uploadButtonActive = false;
    $scope.message = "";
    $scope.message = "Choose a file and mode and press submit.";
    $scope.messageClass = "form-group";
    $scope.searchTypeCollectionName="collectionName";
    $scope.searchTypeDirectory="directory";
    $scope.searchTypeRootName="rootName";
    $scope.searchTypePartialUri="partialUri";
    $scope.searchTypeDescription={ };
    $scope.searchTypeDescription[$scope.searchTypeCollectionName]={title:"Collection name",message:"Please enter a collection name!"};
    $scope.searchTypeDescription[$scope.searchTypeDirectory]={title:"Directory name",message:"Please enter Directory name to search"};
    $scope.searchTypeDescription[$scope.searchTypeRootName]= {title:"Root Element Name",message: ""};
    $scope.searchTypeDescription[$scope.searchTypePartialUri] ={title:"URI",message:"Enter partial uri (wildcard pattern) or a complete URI"};
    $scope.noResultsMessage="";
    	
    $scope.formInput = {};
    $scope.formInput.selectedDatabase = '';
    $scope.formInput.queryName = '';
    $scope.formInput.startingDocType = '';
    $scope.displayOrder = 'alphabetical';

    $scope.inputField = {};
    $scope.formInput.searchString = '';
    $scope.searchType = '';
    $scope.uris=[];
    $scope.doc={text:"",type:"",uri:""};
    $scope.rootElements = [];
    $scope.urisStack=[];

    $scope.isNamespaceAware = true;
    $scope.showNamespaces = false;
    $scope.filename = '';
    $scope.fileType = 0;
    if ( $scope.editMode ) {
        wizardService.getQueryView($scope.loadQueryName, $scope.loadDocType,$scope.loadViewName,$scope.insertView )
            .success(function (data, status) {
                if (status == 200) {
                    console.log("TYPE")
                    console.log(data.type)
                    $scope.wizardForm={type:data.type,prefix:data.prefix}
                    $scope.wizardForm.rootElement=data.rootElement
                    $scope.formInput.queryName=data.queryName
                    if ( !$scope.insertView ) {
                        $scope.formInput.viewName = data.viewName
                    }
                    $scope.formInput.selectedDatabase=data.database
                    $scope.displayOrder = data.displayOrder
                    $scope.wizardForm.possibleRoots=data.possibleRoots
                    $scope.wizardForm.namespaces=data.namespaces
                    $scope.wizardForm.fields=data.fields
                    for(var index = 0; index < $scope.wizardForm.fields.length; index++){
                        console.log(createTitle(data.fields[index].elementName));
                        $scope.wizardForm.fields[index].defaultTitle = createTitle(data.fields[index].elementName);
                        $scope.wizardForm.fields[index].include = $scope.wizardForm.fields[index].includeMode != 'none'
                    }
                    $scope.step = 2
                }
            }).error(function (err) {
                console.log(err)
        });
    }

    $scope.toggleNamespaces = function() {
    	$scope.showNamespaces = !$scope.showNamespaces;
    }

    $scope.to_trusted = function(html_code) {
        return $sce.trustAsHtml(html_code);
    };

    // $http.get('/api/wizard/upload-form').success(function(data, status, headers, config) {
    //   if (status == 200){
    //     $scope.uploadForm = data;
    //   }
    // });

    $scope.wizardUploadFormData = null;

    databaseService.list().then(function(data) {
        $scope.availableDatabases = data;
    });

    $scope.$watch('formInput.selectedDatabase', function(value) {
        if ($scope.step !== 1 || $scope.docTypeMethod !== 'select' || !value) {
            return;
        }
        wizardService.listDocTypes(value).then(function(docTypes) { 
            $scope.availableDocTypes = docTypes || [];
            var error = _.isEmpty(docTypes);
            $scope.message = error ? 
                "Could not find any available document types.  Perhaps it contains no documents or you currently have insufficient permissions to read them." 
                : "";
        });
    });

    $scope.$watch('docTypeMethod', function() {
        $scope.message = "";
    });

    $scope.resetSelectedDoc=function(){$scope.doc={text:"",type:"",uri:""}};
    $scope.openDocSelectionModal=function(searchType){
    		$scope.uris=[]
    		$scope.searchType=searchType;
    		$scope.resetSelectedDoc();
    		$scope.formInput.searchString="";
    		$scope.noResultsMessage="Please enter search criteria and click search.";
    		$http.get('/api/adhoc', {}, {
            withCredentials: true,
            headers: {'Content-Type': undefined },
            transformRequest: angular.identity
        }).success(function(data, status){
            if (status == 200){
                $scope.step = 1; 
                $scope.wizardForm = {databases:data};
            		$("#selectDocument").modal();
            }
        }).error(function(err){
           console.log(err);
           $scope.message = "An error occurred. Check the browser console log for details.";
           $scope.messageClass = "form-group has-error";
         });
    };
    $scope.next=function(){  $scope.searchDocuments("","next");};
    $scope.prev=function(){  $scope.searchDocuments("","prev");};
    
    $scope.searchDocuments=function(docUri,nav){
    		$scope.doc={text:"",type:"",uri:docUri}
    		var params = new FormData();
		params.append("database",$scope.formInput.selectedDatabase);
		params.append( "docUri" ,docUri?docUri:"");
		params.append("collectionName" ,$scope.searchType == $scope.searchTypeCollectionName?$scope.formInput.searchString:"");
		params.append("directory", $scope.searchType == $scope.searchTypeDirectory?$scope.formInput.searchString:"");
		params.append("rootElementName", $scope.searchType == $scope.searchTypeRootName?$scope.formInput.searchString:"");
		params.append("partialUri", $scope.searchType == $scope.searchTypePartialUri?$scope.formInput.searchString:"");
		if($scope.urisStack && $scope.urisStack.length>0){
    			if(nav == "next"){
        			params.append("startUri", $scope.urisStack[($scope.urisStack.length - 1)])
        		}
        		else if(nav == "prev"){
        			$scope.urisStack.pop()
        			params.append("startUri", $scope.urisStack.length>0?$scope.urisStack.pop():"");
        		}
        		else{
        			//new search
        			$scope.urisStack=[];
        			params.append("startUri", "")
        		}
    		}
		
		$http.post('/api/wizard/documentSelection', params, {
            withCredentials: true,
            headers: {'Content-Type': undefined },
            transformRequest: angular.identity            
        }).success(function(data, status,headers){
            if (status == 200){
                $scope.step = 1; 
                if(docUri){
                		var contentType=headers("content-type")
                		if ( contentType.includes("application/json")) {
				        $scope.doc.text = vkbeautify.json(data);
				        $scope.doc.type = "application/json";
				        
				      } else if ( contentType.includes("application/xml")) {
				    	  	$scope.doc.text = vkbeautify.xml(data);
				    	  	$scope.doc.type = "application/xml";
				      } 
				      else{
				    	  	//do nothing
				      }
                }
                else{
                		$scope.uris=data.results   
                		if($scope.searchType == $scope.searchTypePartialUri){
                			var maxIndex=0
                			if($scope.urisStack.length>0)
                			{
                				maxIndex=$scope.urisStack[$scope.urisStack.length-1]
                			}
                			var newMax=parseInt(maxIndex)+$scope.uris.length
                			$scope.urisStack.push(newMax);                    		                			
                		}
                		else{
                			$scope.urisStack.push($scope.uris[($scope.uris.length - 1)])
                		}
                		$scope.noResultsMessage="No results found";
                }                
            }
        }).error(function(err){
           console.log(err);
           $scope.message = "An error occurred. Check the browser console log for details.";
           $scope.messageClass = "form-group has-error";
         });
    };
    $scope.$watch('formInput.selectedDatabase', function(newValue) {
        if($scope.searchType == $scope.searchTypeRootName) {
        		$scope.rootElements = [];
          	var params = new FormData();
	  		params.append("database",newValue);
	  		
	  		$http.post('/api/wizard/documentSelection', params, {
	              withCredentials: true,
	              headers: {'Content-Type': undefined },
	              transformRequest: angular.identity            
	          }).success(function(data, status){
	              if (status == 200){
	                  $scope.step = 1; 
	                  $scope.rootElements=data.results                    
	              }
	          }).error(function(err){
	             console.log(err);
	             $scope.message = "An error occurred. Check the browser console log for details.";
	             $scope.messageClass = "form-group has-error";
	           });
        }
    });
    $scope.selectDocument = function() {
		$scope.filename = $scope.doc.uri;
        $scope.wizardUploadFormData = new FormData();
        //Take the first selected file
        var fileMimeType = $scope.doc.type;
        if ( !isSupportedFileType(fileMimeType) ) {
            $scope.message = "This file-type is not supported. Choose a different file.";
            $scope.uploadButtonActive = false;
            $scope.messageClass = "form-group has-error";
        } else {
            $scope.message = "Select the desired mode and press the create button";
            $scope.wizardUploadFormData.append("uploadedDoc", $scope.doc.text);
            $scope.wizardUploadFormData.append("mimeType", fileMimeType);
            $scope.messageClass = "form-group"
            $scope.uploadButtonActive = true;
            $scope.resetSelectedDoc();
            $("#selectDocument").modal("hide"); 
        }
    };
    
    $scope.changeFile = function(files) {
        if (files.length > 0){
        	// kind of hacky, but the event wasn't triggering a digest cycle so the 
        	// screen wasn't updated with the file name
        	$interval(function() {
            	$scope.filename = files[0].name;
        	},300, 1);
            $scope.wizardUploadFormData = new FormData();
            //Take the first selected file
            var fileMimeType = files[0]['type'];
            if ( !isSupportedFileType(fileMimeType) ) {
                $scope.message = "This file type is not supported. Please choose a different file.";
                $scope.uploadButtonActive = false;
            } else {
                $scope.wizardUploadFormData.append("uploadedDoc", files[0]);
                $scope.wizardUploadFormData.append("mimeType", files[0]['type']);
                $scope.uploadButtonActive = true;
            }
        }
        else
        {
            $scope.wizardUploadFormData = null;
            $scope.uploadButtonActive = false;
        }

    };

    $scope.includeChanged = function(field){
    	if(field.includeMode == "none"){
    		field.include = false;
    	}else {
    		field.include = true;
    		if(field.title == undefined || field.title.trim() == ""){
    			field.title = field.defaultTitle;
    		}
    	}
    };

    $scope.selectDocumentType = function() {
        if ($scope.docTypeMethod === 'upload') {
            $scope.upload();
        }
        else if ($scope.docTypeMethod === 'select') {
            $scope.sample();
        }
    };

    function fromHex(item) {
        var hexes = item.match(/.{1,4}/g) || [];
        var back = "";
        for(var j = 0; j<hexes.length; j++) {
            back += String.fromCharCode(parseInt(hexes[j], 16));
        }
        return back;
    }

    function prepareStep2(data) {
        $scope.step = 2; 
        $scope.wizardForm = data;
        for(var index = 0; index < data.fields.length; index++){ 
            data.fields[index].include = false;
            data.fields[index].includeMode = "none";
            data.fields[index].defaultTitle = createTitle(data.fields[index].elementName);
        }
    }

    $scope.sample = function() {
        var database = $scope.formInput.selectedDatabase;
        var docType = $scope.formInput.startingDocType;
        wizardService.sampleDocType(database, docType.ns, docType.localName, $scope.queryView)
        .success(function(data, status) {
            if (status == 200) {
                prepareStep2(data);
            }
        }).error(function(err){
           console.log(err);
           $scope.message = "An error occurred. Check the browser console log for details.";
           $scope.messageClass = "form-group has-error";
         });
    };

    $scope.upload = function(){
        if ($scope.wizardUploadFormData == null){
            $scope.message = 'Please choose a file using the browse button.';
            return;
        }
        $scope.wizardUploadFormData.append('type',$scope.queryView);
        var fileMimeType = $scope.wizardUploadFormData.get('mimeType');
        $scope.isNamespaceAware = isNamespaceAwareMimeType(fileMimeType)
        $scope.fileType = getFileType(fileMimeType)
        if ( !isSupportedFileType(fileMimeType) ) {
              $scope.message = "This file-type is not supported. Choose a different file";
              $scope.uploadButtonActive = false;
        } else {
            console.log("UPLOAD")
            $http.post('/api/wizard/upload', $scope.wizardUploadFormData, {
                withCredentials: true,
                headers: {'Content-Type': undefined },
                transformRequest: angular.identity
            }).success(function(data, status){
                if (status == 200) {
                    prepareStep2(data);
                }
            }).error(function(err){
               console.log(err);
               $scope.message = "An error occurred. Check the browser console log for details.";
               $scope.messageClass = "form-group has-error";
             });
        }
    };

    
    $scope.validForm = function() {
        if($scope.queryView == 'view' && ( $scope.formInput.viewName == '' || $scope.formInput.viewName == undefined )){
            return false
        }
    	if($scope.formInput.queryName == ''){
    		return false;
    	}
    	if($scope.wizardForm.rootElement == ''){
    		return false;
    	}
    	if($scope.formInput.selectedDatabase == ''){
    		return false;
    	}
    	// make sure they've included at least one field and it is populated with a name
    	var fieldsChosen = 0;
    	var invalidField = false;
        for (var index = 0; index < $scope.wizardForm.fields.length; index++){
        	if($scope.wizardForm.fields[index].include){
        		fieldsChosen++;
        	}
        	if($scope.wizardForm.fields[index].include && ($scope.wizardForm.fields[index].title == undefined || $scope.wizardForm.fields[index].title.trim() == "")){
        		invalidField = true;
        	}
        }
        if(fieldsChosen == 0 || invalidField){
        	return false;
        }
        	
    	return true;
    };
    
    $scope.back = function() {
        $window.location.href = '/crud';
    };

    $scope.submitWizard = function(){
        var data = {}
        data.overwrite = $scope.editMode ? "OVERWRITE" : "INSERT"
        data.queryText = '';
        data.prefix = $scope.wizardForm.prefix;
        data.rootElement = $scope.wizardForm.rootElement;
        data.displayOrder = $scope.displayOrder;
        data.namespaceCount = $scope.wizardForm.namespaces.length;
        data.possibleRootsCount = $scope.wizardForm.possibleRoots.length + 1;
        if ( $scope.wizardForm.possibleRoots.length > 0 ) {
            var counter = 1;
            data['possibleRoot' + counter] = $scope.wizardForm.rootElement;
            counter += 1;
            for (var i = 1; i <= $scope.wizardForm.possibleRoots.length; i++) {
                data['possibleRoot' + counter] = $scope.wizardForm.possibleRoots[i];
                counter += 1;
            }
        }
        if ( $scope.wizardForm.namespaces.length > 0 ) {
            var counter = 1;
            for (var i = 1; i <= $scope.wizardForm.namespaces.length; i++) {
                data['namespaceAbbrv' + counter] = $scope.wizardForm.namespaces[i-1].abbrv;
                data['namespaceUri' + counter] = $scope.wizardForm.namespaces[i-1].uri;
                counter += 1;
            }
        }
        data.database = $scope.formInput.selectedDatabase;
        data.fileType =  $scope.fileType;
        data.queryName = $scope.formInput.queryName;
        if ($scope.wizardForm.type.toLowerCase() === 'query'){
            data.viewName = '';
        } else {
            data.viewName = $scope.formInput.viewName;
        }
        var counter = 1;
        for (var i = 1; i <= $scope.wizardForm.fields.length; i++){
                data['formLabel'+counter] = $scope.wizardForm.fields[i-1].title;
                data['formLabelHidden'+counter] = $scope.wizardForm.fields[i-1].xpathNormal;
                data['formLabelDataType'+counter] = $scope.wizardForm.fields[i-1].dataType;
                data['formLabelIncludeMode' + counter] = $scope.wizardForm.fields[i-1].includeMode;
                counter += 1;
        }
        console.log('sending...');
        console.dir(data);
        $http.get('/api/wizard/create',{
            params:data
        }).success(function(data, status, headers, config) {
            if ( data.status === 'exists') {
               alert("A query with this query name and document type already exists.");
            } else if ( data.status == 'dataError') {
               alert("A data error occurred.");
            } else if ( data.status == 'saved') {
                // TODO Uncomment
                //$window.location.href = '/crud';
            }
        }).error(function(data, status){
              alert("Server Error, please make changes and try again");
        });
    };
    
    function createTitle(suggestedName){
    	var namespaceDelimPos = suggestedName.indexOf(":");
    	if(namespaceDelimPos != -1){
    		return suggestedName.substr(namespaceDelimPos+1);
    	}
    	
    	return suggestedName;
    }

  });

function getFileType(mimeType) {
    if ( mimeType === "text/xml" || mimeType == "application/xml" ) {
       return 0;
    } else if ( mimeType == "application/json" ) {
           return 1;
    }
    return -1;
}
function isNamespaceAwareMimeType(mimeType) {
    return getFileType(mimeType) == 0;
}

function isSupportedFileType(mimeType) {
    return getFileType(mimeType) >= 0;
};
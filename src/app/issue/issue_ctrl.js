angular.module('Trestle.issue', [])

.directive('trIssueCard', function() {
   return {
      restrict: 'EA',
      replace: true,
      templateUrl: "issue/issue.tpl.html",
      scope: {
         // XXX: This should allow access in the template but is not for some reason
         //      need to figure this out and make better.
         issue: '=issue'
      }
   };
})

.controller('IssueCtrl', function($scope, $modal, $rootScope, trRepoModel, gh, trIssueCache) {
   $scope.repoModel = trRepoModel;

   // init
   _.extend(this, {
      init: function(issue) {
         var me = this;

         this.issue          = issue;
         this.lastViewedData = trIssueCache.getLastViewedData(this.issue);

         $scope.$id = "IssueCtrl:" + issue.number + $scope.$id;

         $rootScope.$on('markAllIssuesRead', function(event) {
            me.markAsViewed();
         });
      },

      /** Return true if the given label is enabled on our issue.
      */
      isLabelEnabled: function(labelName) {
         return _.contains(this.issue.tr_label_names, labelName);
      },

      /**
      * Toggle the state of the given label.
      */
      toggleLabel: function(labelObj) {
         var enable = !this.isLabelEnabled(labelObj.name);

         // Set label names locally so we can short-circut the roundtrip to github
         if(enable) {
            this.issue.labels.push(labelObj);
            this.issue.tr_label_names.push(labelObj.name);
         } else {
            this.issue.labels = _.filter(this.issue.labels, function(label) {
               return label.name !== labelObj.name;
            });
            this.issue.tr_label_names = _.without(this.issue.tr_label_names, labelObj.name);
         }

         // Push change to github
         gh.updateIssue(trRepoModel.owner, trRepoModel.repo,
                        this.issue.number, {labels: this.issue.tr_label_names}).then(
            function(result) {
               console.log('assignment: success');
            }
         );
      },

      showIssueDetails: function() {
         var me = this;

         me.markAsViewed();

         // Create a local scope for the template and add the issue into it
         var modal_scope = $rootScope.$new();
         modal_scope.$id = "modal:issue_details:" + modal_scope.$id;

         modal_scope.issue = this.issue;

         var opts = {
            scope        : modal_scope,
            backdrop     : true,
            keyboard     : true,
            templateUrl  : "issue/issue_details.tpl.html"
         };
         // todo: remove this setting when future version of $modal adds automatically
         // - see: https://github.com/trestle-pm/trestle/issues/80
         $rootScope.modalIsUp = true;
         $modal.open(opts).result.finally(function() {
            $rootScope.modalIsUp = false;

            // mark is as viewed in case we did the modification
            me.markAsViewed();
         });
      },

      /**
      * Popup dialog to allow converting issue to pull.
      */
      convertToPull: function() {
         var modal_scope = $rootScope.$new();

         modal_scope.issue = this.issue;

         var opts = {
            scope        : modal_scope,
            windowClass  : 'convert-modal',
            backdrop     : true,
            keyboard     : true,
            templateUrl  : "issue/convert_to_pull.tpl.html"
         };
         $modal.open(opts);
      },

      /*
      * Called to assign the given user to the issue.
      */
      assignUser: function(user) {
         console.log("Assigning: " + user.login);
         // short-circut locally to get immediate update
         this.issue.assignee = user;

         gh.updateIssue(trRepoModel.owner, trRepoModel.repo,
                        this.issue.number, {assignee: user.login}).then(
            function(result) {
               console.log('assignment: success');
            }
         );
      },

      /**
      * Assign the issue to a milestone given the milestone's number
      */
      assignMilestone: function(msNumber) {
         console.log('assigned milestone: ' + msNumber);
         var new_milestone = null;

         // short-circut so we see locally.
         if(msNumber) {
            new_milestone = _.find(trRepoModel.milestones, function(ms) {
               return ms.number === msNumber;
            });
         }
         this.issue.milestone = new_milestone;

         // tell github about the update
         gh.updateIssue(trRepoModel.owner, trRepoModel.repo,
                        this.issue.number, {milestone: msNumber})
            .then(function(result) {
               console.log('assign milestone: success');
            }
         );
      },

      /** Return true if we think the issue has been updated in some way
      * since our last view
      */
      hasBeenUpdatedSinceLastView: function() {
         var viewed_data = trIssueCache.buildViewData(this.issue);
         return !_.isEqual(viewed_data, this.lastViewedData);
      },

      /**
      * Mark the issue as being read and store any temporal information we need
      * for caching to show changes.
      */
      markAsViewed: function() {
         this.lastViewedData = trIssueCache.setLastViewedData(this.issue);
      }

   });

   this.init($scope.$parent.issue);
})

;

#!/bin/bash

# Prepublish checks

set -e

REPO=js-builder

if [ "$npm_config_tag" != "latest" ]
then
    echo "Not checking git version because npm_config_tag is \"$npm_config_tag\""
else
    # Make sure that the local branch tip revision is the same
    # as upstream master.
    LOCAL_TIP=$(git rev-parse HEAD)
    REMOTE_TIP=$(git ls-remote https://github.com/jenkinsci/$REPO master | awk '{ print $1 }')

    if [ $LOCAL_TIP != $REMOTE_TIP ]
    then
        echo Local git tip $LOCAL_TIP is not the same as upstream remote master tip $REMOTE_TIP. You must push upstream before you can publish, or publish to a beta tag.
        exit 1
    fi
fi

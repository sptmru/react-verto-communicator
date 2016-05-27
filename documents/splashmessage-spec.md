# Component Name: splashmessage #
# 1. Functional Description #

This component displays the conditions, one at a time, that get checked when the communicator loads. If there is an error, such as a user having access to their webcam blocked or an unsupported browser, an error message will take up the bottom part of the screen. This error message will have a red background, and the text color will change to white.  

# 2. Visual Design #

//have to wait util I have the code done to get the screenshots.

# 3. Component Type #

This component will be a 'pure' component.

## a. Required Props ##

| Prop Name | Sample | Description |
| ------------ | ------------- | ------------- |
| progressTitle | "Checking media permissions." | This is what will display underneath the loading bar. This provides the user with updates on what the communicator is doing when it is loading. |
| compStyle | compStyle = {} | This prop is an object and is not required. This object sets the style for this component |
| errorObject | errorObject = {header: "Error", body: "Please enable your webcam and refresh the page"  } | This prop is an object that contains two strings. These two strings are used to print out an error message. |

## b. Component State ##

This is a 'pure' component.

## c. Context-Aware Specification ##

This component is a 'pure component'.

# 4. Reference Components #

* vertobase component

# 5. Unit Testing Requirement #

 Tests can be found in src/tests
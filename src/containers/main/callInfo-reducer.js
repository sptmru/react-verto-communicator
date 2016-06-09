const callInfo = (state, action)=>{

  if (typeof state === 'undefined') {
    return  {
              lastNumber: undefined,
              currentCallId: undefined,
              incomingCalls: {},
              activeCalls: {}
            };
  }
  const oStateReturn = { ...state };

  switch (action.type) {
    case 'CALLING':
      oStateReturn.lastNumber = action.data.destination;
      oStateReturn.currentCallId = action.data.callId;
      oStateReturn.activeCalls[action.data.callId] = action.data;
      // remove it from incoming if you answered it
      if (oStateReturn.incomingCalls && oStateReturn.incomingCalls[action.data.callId] ){
        // delete
        delete oStateReturn.incomingCalls[action.data.callId];
      }
      return oStateReturn;
    case "INCOMING_CALL":
      oStateReturn.incomingCalls[action.daa.callId] = action.data;
      return oStateReturn;
    case "CONFERENCE_DATA":
      //console.log('<<<<', state, action.data );
      // did i call in or is it incoming
      if (state.activeCalls[action.data.callId] ) {
        oStateReturn.activeCalls[action.data.callId]["conferenceData"] = { ...oStateReturn.activeCalls[action.data.callId]["conferenceData"], ...action.data};
      }

      return oStateReturn;
    case 'CALL_HUNG_UP':
      // is it a number I called
      if (state.activeCalls[action.data.callID]){
        // only hangup numbers i know about
        // remove it
        if (action.data.callID === oStateReturn.currentCallId) {
          oStateReturn.currentCallId = undefined;
        }
        delete oStateReturn.activeCalls[action.data.callID];
      }

      //console.log('aaaaaaahhhhhh bbbbaaadddd', action.data);
      return oStateReturn;

    case 'RECEIVED_CHAT_MESSAGE':
      //console.log('<<<<< CHAT: ', oStateReturn, action.data, oStateReturn.activeCalls[action.data.callID], oStateReturn.activeCalls[action.data.callID] && oStateReturn.activeCalls[action.data.callID].conferenceData   );
      if (oStateReturn.activeCalls[action.data.callID] && oStateReturn.activeCalls[action.data.callID].conferenceData ) {
        // ok have conference
        if (!oStateReturn.activeCalls[action.data.callID].conferenceData.messages) {

          // first message
          oStateReturn.activeCalls[action.data.callID].conferenceData.messages = [];
        }

        // now append it append
        oStateReturn.activeCalls[action.data.callID].conferenceData.messages = oStateReturn.activeCalls[action.data.callID].conferenceData.messages.concat([action.data]);
        //console.log('<<<***** ', oStateReturn.activeCalls[action.data.callID]);

      } else {
        console.log('hmmm no conference on receive a chat message weird');
      }
      return oStateReturn;
    default:
     return oStateReturn;
    }
};

export { callInfo };
import {doLogOut, doVertoLogin, doMakeCallError, doHungUp, doCallHeld,
   doingMakeCall, doIncomingCall, doConferenceData, doReceiveChat } from '../containers/main/action-creators';
import VideoConstants from './VideoConstants';
import md5 from 'md5';
import CallHistoryService from './callHistoryService';

// private stuff
let _callbacks;
let _dispatch;
let _verto;





//class
class VertoService {
  constructor(){
    //console.log('building VERTO SERVICE: <<<<<<<<<<<<<<<<')
    this._data = {_activeCalls:[], _maxActiveCalls: 32 };

    const xInstance = this;

    window.v = this;
    _callbacks = {
      onMessage: (v, dialog, msg, params) => {
        //console.debug('^^^^^^^ onMessage:', v, dialog, msg, params);

        switch (msg) {
          case $.verto.enum.message.pvtEvent:
            if (params.pvtData) {
              switch (params.pvtData.action) {
                case "conference-liveArray-join":

                  if (!params.pvtData.screenShare && !params.pvtData.videoOnly) {
                    //console.log("conference-liveArray-join");
                    xInstance.stopConference();
                    xInstance.startConference(v, dialog, params.pvtData);
                  }
                  break;
                case "conference-liveArray-part":
                  if (!params.pvtData.screenShare && !params.pvtData.videoOnly) {
                    //console.log("conference-liveArray-part");
                    xInstance.stopConference();
                  }
                  break;
              }
            }
            break;
          default:
            console.warn('Got a not implemented message:', msg, dialog, params);
            break;
        }
      }, //end onMessage

      onDialogState: (d)=> {
          //adding params since this is what is sent to processor

          d.params.direction = d.direction.name;
          if (d.audioStream && d.audioStream.volume)
            d.params.volume =  d.audioStream.volume;
          d.params.event = d.state;
          d.params.caller_id_ext = parseInt(d.params.caller_id_number);
          d.params.remote_caller_id_ext = parseInt(d.params.remote_caller_id_number);

          switch (d.state) {
              case $.verto.enum.state.ringing:
                  //console.log('^^^^^^ringing ... onDialogState display', d);

                  xInstance._data._activeCalls[d.callID] = d;

                  //console.log('#### s2sVerto.activeCalls.length', s2sVerto.activeCalls.length);
                  //console.log('#### s2sVerto.maxActiveCalls', s2sVerto.maxActiveCalls);

                  CallHistoryService.getInstance().add({
                    timestamp: Date.now(),
                    callerId: d.params.caller_id_number,
                    direction: d.params.direction
                  });

                	if (Object.keys(xInstance._data._activeCalls).length > xInstance._data._maxActiveCalls) {
                		d.hangup();
                	} else {
                		d.params.direction = d.direction.name;
                    // update parames
                    d.params.caller_id_ext = parseInt(d.params.caller_id_number);

                		//jes inbound call
                		//Processor.starphone('inboundCall', d.params);
                    _dispatch(doIncomingCall(d));
                	}

                  break;

          case $.verto.enum.state.trying:
              //jes tell it is ringing
              //display("Calling: " + d.cidString());
              //goto_page("incall");
              //console.log('^^^^^^trying .. calling', d);
              CallHistoryService.getInstance().add({
                timestamp: Date.now(),
                callerId: d.params.destination_number,
                direction: d.params.direction
              });
              _dispatch(doingMakeCall('trying', d.params.destination_number, d.callID, d.direction.name));
              break;

          case $.verto.enum.state.early:
              //console.log('^^^^^^early:', d);
              break;

          case $.verto.enum.state.active:
              //jes tell them we are now talking
              //display("Talking to: " + d.cidString());
              //goto_page("incall");
              //console.log('^^^^^active ...:', d);
              d.params.isHeld = false;
              // ta- added to init isMuted attribute
              d.params.isMuted = false;
              //console.log('active call s2sverto: ', d.immediateTransfer, d.immediateTransferURI);
              if (d.immediateTransfer && d.immediateTransferURI) {
              	//code

              	d.transfer(d.immediateTransferURI);
              	delete d.immediateTransfer;
              	delete d.immediateTransferURI;
              } else {
                //Processor.starphone('answered', d.params);
                _dispatch(doingMakeCall('active', (d.direction.name == 'outbound' ? d.params.destination_number : d.params.caller_id_number), d.callID, d.direction.name));
              }

              break;

          case $.verto.enum.state.hangup:
              //jes tell we are hanging up
              //console.log('^^^^^^^^^hangup event', d);
              if (xInstance._data._activeCalls[d.callID]) {
                  delete xInstance._data._activeCalls[d.callID];
              } else {
                  //console.log('hangup not found', d, s2sVerto.activeCalls);
              }
              break;

          case $.verto.enum.state.destroy:
              //jes tell we are done now
              //console.log('^^^^^^^^^^destroy event', d);
              //console.debug('Destroying: ' + d.cause);
              if (d.params.screenShare) {
                //TODO cleanShareCall(xInstance);
              } else {
                xInstance.stopConference();
                //TODO
                // if (!xInstance.reloaded) {
                //   cleanCall();
                // }
              }

              _dispatch(doHungUp(d));
              break;

          case $.verto.enum.state.held:
              //jes tell the UI we are on HOLD
              //console.log('****** HELD ....', d);
              d.params.isHeld = true;
              _dispatch(doCallHeld(d.callID));
              break;

          case $.verto.enum.state.requesting:
              //console.log('^^^^^^^REQUESTING ....', d);
              xInstance._data._activeCalls[d.callID] = d;
              //jes tom does not want it
              //TODO
              //Processor.starphone('requesting', d.params);
              break;

          default:
              //display("");
              console.error('^^^^^^^default state not handled:', d.state, d);
              break;
          }
      },

      onWSLogin: (v, success) => {
        //console.log('onWSLogin: ', v, success);
        //display("");
        _dispatch(doVertoLogin(success, (success ? v.options : null) ));
      },

      onWSClose: (v, success) => {
        //console.log('onWSClose', arguments);
        _dispatch(doLogOut());
      },

      onEvent: (v, e) => {
        console.debug("GOT EVENT", v, e);
      },

    };


    this.login = this.login.bind(this);
    this.getOptions = this.getOptions.bind(this);
    this.stopConference = this.stopConference.bind(this);
    this.startConference = this.startConference.bind(this);
    this.sendConferenceCommand = this.sendConferenceCommand.bind(this);

    VertoService.getInstance = VertoService.getInstance.bind(this);
    VertoService.login = VertoService.login.bind(this);
    VertoService.logout = VertoService.logout.bind(this);
    VertoService.mediaPerm = VertoService.mediaPerm.bind(this);
    VertoService.speedTest = VertoService.speedTest.bind(this);
    VertoService.refreshVideoResolution = VertoService.refreshVideoResolution.bind(this);
    VertoService.updateResolutions = VertoService.updateResolutions.bind(this);

  }

  startConference(v, dialog, pvtData) {
    //$rootScope.$emit('call.video', 'video');
    //$rootScope.$emit('call.conference', 'conference');
    //console.log('^^^^^ startConference: ', v, dialog, pvtData);
    this._data.chattingWith = pvtData.chatID;
    this._data.confRole = pvtData.role;
    this._data.conferenceMemberID = pvtData.conferenceMemberID;


    this.userColors = {};
    this.lastColorIndex = -1;

    this.getChatUserColor = (user) => {
      // pre-defined color array
      const colorArray =  new Array('#FFFFFF', '#e1e1e1', '#E0F1D8', '#CEFFEF', '#EFDACC', '#F6F5CE', '#E7DBEC', '#EAF4FE', '#FDEAEC', '#FDE3F7');
      // have i assigned the user a color already
      if (!this.userColors[user]) {
        // nope so will get them a color
        // am i at the length of the color array
        if (this.lastColorIndex + 1 === colorArray.length ) {
          // yep at max length so assigning to zero
          this.lastColorIndex =0;
        } else {
          // incrementing
          this.lastColorIndex = this.lastColorIndex + 1;
        }
        //populating on the user colors object
        this.userColors[user] = colorArray[this.lastColorIndex];
      }

      //console.log('CCCC: ', this.userColors[user] );
      // returning the user color from the user object
      return this.userColors[user];
    }

    var conf = new $.verto.conf(v, {
      dialog: dialog,
      hasVid: true, //TODO storage.data.useVideo,
      laData: pvtData,
      chatCallback: (v, e) => {

        var displayName = e.data.fromDisplay || e.data.from || "Unknown";
        var message = e.data.message || "";
        var callID = Object.keys(v.dialogs)[0];

        const sentUser = e.data.from.substring(0, e.data.from.indexOf('@'));
        const currentUser = v.options.loginParams.user;
        console.log('chatCallback ..... ', e,v );
        _dispatch(doReceiveChat(callID, {callID, displayName, message, utc_timestamp: Date.now(), isMe: sentUser == currentUser , bgColor: this.getChatUserColor(sentUser) }));
      },
      onBroadcast: (v, conf, message) => {
        console.log('>>> conf.onBroadcast:', message, arguments);
        if (message.action == 'response') {
          // This is a response with the video layouts list.
          if (message['conf-command'] == 'list-videoLayouts') {
            //console.log('hmmmmmmm', message.responseData);
            var rdata = [];

            for (var i in message.responseData) {
              rdata.push(message.responseData[i].name);
            }

            var options = rdata.sort(function(a, b) {
              var ga = a.substring(0, 6) == "group:" ? true : false;
              var gb = b.substring(0, 6) == "group:" ? true : false;

              if ((ga || gb) && ga != gb) {
                return ga ? -1 : 1;
              }

              return ( ( a == b ) ? 0 : ( ( a > b ) ? 1 : -1 ) );
            });
            this._data.confLayoutsData = message.responseData;
            this._data.confLayouts = options;
          } else if (message['conf-command'] == 'canvasInfo') {
            this._data.canvasInfo = message.responseData;
            //console.log('..... CANVASINFO ...', message );
            //TODO
            //$rootScope.$emit('conference.canvasInfo', message.responseData);
          } else {
            //TODO
            //console.log('..... ELSE ONBROADCAST ...', message );
            //$rootScope.$emit('conference.broadcast', message);
          }
        }
      }
    });
    //window.CONF = conf;

    if (this._data.confRole == "moderator") {
      //console.log('>>> conf.listVideoLayouts();', conf );
      setTimeout(()=> {
        //console.log('sending listVideoLayout')
        conf.listVideoLayouts();}, 0);
        conf.modCommand('canvasInfo');
    } else {
      //console.log('NOT Moderator but i am: ', this._data.confRole);
    }

    this._data.conf = conf;

    this._data.liveArray = new $.verto.liveArray(
      //jes fixed this ... check on instance ..this._data.instance
      _verto.verto, pvtData.laChannel,
      pvtData.laName, {
        userObj: {
          a: 'j',
          b: 1
        },
        subParams: {
          callID: dialog ? dialog.callID : null
        }
      });
    //window.LA = this._data.liveArray;

    //console.log('>>>>>> livearray: ',  Object.keys(_verto.verto.dialogs)[0] );

    this._data.liveArray.onErr = (obj, args) => {
      console.log('liveArray.onErr', obj, args);
    };

    this._data.liveArray.getUsers = (obj) => {
      let users = {};
      obj.each((k)=>{
        const x = obj.get(k);
        //console.log('********', x);
        users[k] = { memberId: x[0], callerId: x[1], name: x[2], codec: x[3], conferenceStatus: JSON.parse(x[4]), avatar: x[5] };
      })

      return users;
    };

    this._data.liveArray.onChange = (obj, args) => {
      //window.foo = obj;
      //console.log('liveArray.onChange --- action: %s',args.action,  obj, args);

      switch (args.action) {
        case 'bootObj':
          // args.data.map((member)=>{
          //   console.log('BBBB:', member[0], member[1]);
          // });

          //TODO
          //$rootScope.$emit('members.boot', args.data);
          // args.data.forEach(function(member){
          //   var callId = member[0];
          //   //TODO fix this
          //   // var status = true; //angular.fromJson(member[1][4]);
          //   // if (callId === data.call.callID) {
          //   //   $rootScope.$apply(function(){
          //   //     data.mutedMic = status.audio.muted;
          //   //     data.mutedVideo = status.video.muted;
          //   //   });
          //   // }
          // });
          //break;
        case 'add':
          //var member = [args.key, args.data];
          //TODO $rootScope.$emit('members.add', member);
          //break;
        case 'del':
          //var uuid = args.key;
          //TODO $rootScope.$emit('members.del', uuid);
          //break;
        case 'clear':
          //TODO $rootScope.$emit('members.clear');
          //break;
        case 'modify':
          //var member = [args.key, args.data];
          //TODO $rootScope.$emit('members.update', member);
          //break;

          _dispatch(doConferenceData({callId: Object.keys(obj.verto.dialogs)[0], users: obj.getUsers(obj) }));
          break;
        default:
          console.log('NotImplemented', args.action);
      }
    };
  }

  stopConference() {
    //console.log('stopConference()', this, this._data );
    if (this._data.liveArray) {
      this._data.liveArray.destroy();
      //console.log('Has data.liveArray.');
      //TODO $rootScope.$emit('members.clear');
      this._data.liveArray = null;
    }

    if (this._data.conf) {
      this._data.conf.destroy();
      this._data.conf = null;
    }
  }


  login(data){
    //console.log('logging in',  data);
    const v = new $.verto(this.getOptions(data), _callbacks );


    _verto.verto =v;
    //console.log('>>>>>', _verto.verto, this._data);
  }

  sendDtmf(callerId, keys) {
    //console.log('SENDING DTMF:', callerId, keys);
    if (_verto._data._activeCalls[callerId]) {
      _verto._data._activeCalls[callerId].dtmf(keys);
    } else {
      console.log('DTMF    NOT FOUND----------');
    }
  }

  muteMic(callerId){
  		this.sendDtmf(callerId, '0');
      // if (_verto._data._activeCalls[callerId]) {
      //   console.log('****', _verto._data._activeCalls[callerId].setMute('toggle'));
      //   //_verto._data._activeCalls[callerId].toggleHold();
      // } else {
      //   console.log('mute mic    NOT FOUND----------');
      // }
  }

  muteVideo(callerId) {
    //console.log('toggle MUTE VIDEO', callerId);
    // if (_verto._data._activeCalls[callerId]) {
    //   console.log('****', _verto._data._activeCalls[callerId].setVideoMute('toggle'));
    //   //_verto._data._activeCalls[callerId].toggleHold();
    // } else {
    //   console.log('hold    NOT FOUND----------');
    // }
    //dialog.rtc.getVideoMute();
    this.sendDtmf(callerId, "*0");
  }

  hold(callerId){
      //console.log('toggle HOLD', callerId);
      if (_verto._data._activeCalls[callerId]) {
        _verto._data._activeCalls[callerId].toggleHold();
      } else {
        console.log('hold    NOT FOUND----------');
      }
  }

  sendConferenceCommand(cmd, params) {

    // if i am moderator allow
    if (_verto && _verto._data && _verto._data.conf
          && _verto._data.conf.params && _verto._data.conf.params.laData
          && _verto._data.conf.params.laData.role == 'moderator') {
          // validate cmd
          if (Object.keys(VideoConstants.CONF_CMDS).indexOf(cmd.toUpperCase()) > -1) {
            // valid command
            _verto._data.conf[VideoConstants.CONF_CMDS[cmd.toUpperCase()]['functionName']].apply(_verto._data.conf, params);
          }  else {
              console.log('sendConferenceCommand: ERROR invalid Command: %s', cmd);
          }
    } else {
      console.log('sendConferenceCommand: ERROR Not Moderator ... how did this happen');
    }


    // send
  }

  getOptions(data) {
    return {
        login: data.user + '@' + data.hostname,
        passwd: data.password,
        socketUrl: data.wsURL,
        tag: "webcam",
        ringFile: null,
        deviceParams: {
          useCamera:  this._data.selectedVideo ? this._data.selectedVideo.id: undefined,
          useSpeak: this._data.selectedSpeaker? this._data.selectedSpeaker.id: undefined,
          useMic:  this._data.selectedAudio ? this._data.selectedAudio.id: undefined,
          onResCheck: VertoService.refreshVideoResolution
        },
        audioParams: {
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true
        },
        iceServers: true,
        loginParams: data
      };
  }

  sendConferenceChat(message) {
    //console.log('sendConferenceChat: ', message);
    _verto._data.conf.sendChat(message, "message");
  }


  answer(callerId){
    if (_verto._data._activeCalls[callerId]) {
      _verto._data._activeCalls[callerId].answer();
    } else {
      console.log('answer    NOT FOUND----------');
    }
  }

  hangup(callerId){
    if (_verto._data._activeCalls[callerId]) {
      _verto.verto.hangup(callerId);
    } else {
      console.log('hangup NOT FOUND----------');
      _verto.verto.hangup();
    }
  }

  makeCall(dispatch, destination, settings) {
    //console.log('calling desitnation', destination);
    _dispatch = dispatch;
    if (!_verto.verto) {
      const message = "not connected";
      return _dispatch(doMakeCallError({destination, message }));
    }
    // ok make a call
    //console.log('DATA & VERTO:', this._data, settings.settings, _verto.verto, md5(_verto.verto.options.loginParams.email));
    const phoneObject = {
      destination_number: destination,
      caller_id_name: _verto.verto.options.loginParams.name,
      caller_id_number: _verto.verto.options.loginParams.callerid ? _verto.verto.options.loginParams.callerid  : _verto.verto.options.loginParams.email ,
      outgoingBandwidth: settings.settings.outgoingBandwidth, //storage.data.outgoingBandwidth,
      incomingBandwidth: settings.settings.incomingBandwidth, //storage.data.incomingBandwidth,
      // get from settings
      useVideo: settings.settings.useVideo, // storage.data.useVideo,
      useStereo: settings.settings.useStereo, //storage.data.useStereo,
      useCamera: settings.settings.useVideo, // storage.data.selectedVideo,
      useSpeak: settings.settings.selectedSpeaker.id, //storage.data.selectedSpeaker,
      useMic: settings.settings.selectedAudio.id, //storage.data.selectedAudio,
      dedEnc: settings.settings.useDedenc, //storage.data.useDedenc,
      mirrorInput: settings.settings.mirrorInput, //storage.data.mirrorInput,
      userVariables: {
        email :  _verto.verto.options.loginParams.email, //storage.data.email,
        avatar:  "http://gravatar.com/avatar/" + md5(_verto.verto.options.loginParams.email) + ".png?s=600"    // "http://gravatar.com/avatar/" + md5(storage.data.email) + ".png?s=600"
      }
    };

    //console.log('------', phoneObject);
    const ncDialog = _verto.verto.newCall(phoneObject);

    //console.log('*****', ncDialog);
    return ncDialog.callID;
  }

  static getInstance() {
    if (!_verto) {
      _verto = new VertoService();
    }

    return  _verto;
  }

  static login(dispatch, data) {
    //console.log('LOGIN DDDD', data);
    _dispatch = dispatch;
    return VertoService.getInstance().login(data);
  }

  static logout(dispatch) {
    _dispatch = dispatch;
    return _verto.verto.logout();
  }

  static mediaPerm(callback) {
      $.FSRTC.checkPerms(callback, true, true);
  }

  static refreshVideoResolution (resolutions){
    setTimeout(()=>{
      //console.debug('Attempting to refresh video resolutions.');
      let data = _verto._data;
      let v = _verto.verto;
      if (!data){
        //console.log('this shouldnt be blank', data);
        data = {};
      }


      //console.log('VVVVVVV', v)
      if (v) {
        var w = resolutions['bestResSupported'][0];
        var h = resolutions['bestResSupported'][1];

        if (h === 1080) {
          w = 1280;
          h = 720;
        }

        data.videoQuality = VertoService.updateResolutions(resolutions['validRes']);

        // videoQuality.length = videoQuality.length - removed;
        //console.log("******* VQ length 2: " + data.videoQuality.length);


        data.vidQual = (data.videoQuality.length > 0) ? data.videoQuality[data.videoQuality.length - 1] : null;
        //console.debug('vidQual', data.vidQual);

        v.videoParams({
          minWidth: w,
          minHeight: h,
          maxWidth: w,
          maxHeight: h,
          minFrameRate: 15,
          vertoBestFrameRate: 15 //TOOD Fix this  --- storage.data.bestFrameRate
        });
        data.videoQuality.map((qual) => {
          if (w === qual.width && h === qual.height) {
            //console.log('****', qual);
            data.vidQual = qual;

            // if (storage.data.vidQual !== qual.id || storage.data.vidQual === undefined) {
            //   storage.data.vidQual = qual.id;
            // }
          }

        });

         //console.log('ddddd:', data);
      } else {
        //console.debug('There is no instance of verto.');
      }

    }, 10);
  }

  static updateResolutions (supportedResolutions) {
    //console.debug('Attempting to sync supported and available resolutions');

    //var removed = 0;

    //console.debug("VQ length: " + VideoConstants.VIDEO_QUALITY_SOURCE.length);
    //console.debug(supportedResolutions);

    return VideoConstants.VIDEO_QUALITY_SOURCE.filter((resolution)=> {
       return supportedResolutions.filter((res) => {
         //console.log('RES: ', res);
          var width = res[0];
          var height = res[1];

        return (resolution.width == width && resolution.height == height);
      }).length > 0;
    });
  }

  static refreshDevices(callback){
    //console.debug('Attempting to refresh the devices.', $.verto );
    $.verto.refreshDevices((status)=>{
      //console.log('refreshing devices ...... here', status);
      let data = VertoService.getInstance()._data;

      if (!data)
        data = {};

      //reset stuff
      data.videoDevices = [{
        id: 'none',
        label: 'No Camera'
      }];
      data.shareDevices = [{
        id: 'screen',
        label: 'Screen'
      }];
      data.audioDevices = [];
      data.speakerDevices = [];

      if(!data.selectedShare) {
        data.selectedShare = data.shareDevices[0];
      }

      $.verto.videoDevices.map((device)=>{
        if (!device.label) {
          data.videoDevices.push({
            id: 'Camera ' + device,
            label: 'Camera ' + device
          });
        } else {
          data.videoDevices.push({
            id: device.id,
            label: device.label || device.id
          });
        };
        // Selecting the first source.
        if (!data.selectedVideo) {
          data.selectedVideo = device;
        }

        if (!device.label) {
          data.shareDevices.push({
            id: 'Share Device ' + device,
            label: 'Share Device ' + device
          });
        } else {
          data.shareDevices.push({
            id: device.id,
            label: device.label || device.id
          });
        };
      });

      $.verto.audioInDevices.map((device)=>{

        // Selecting the first source.
        if (!data.selectedAudio) {
          data.selectedAudio = device;
        }

        if (!device.label) {
          data.audioDevices.push({
            id: 'Microphone ' + device,
            label: 'Microphone ' + device
          });
        } else {
          data.audioDevices.push({
            id: device.id,
            label: device.label || device.id
          });
        };
      });


      $.verto.audioOutDevices.map((device)=>{

        // Selecting the first source.
        if (!data.selectedSpeaker) {
          data.selectedSpeaker = device;
        }

        if (!device.label) {
          data.speakerDevices.push({
            id: 'Speaker ' + device,
            label: 'Speaker ' + device
          });
        } else {
          data.speakerDevices.push({
            id: device.id,
            label: device.label || device.id
          });
        };
      });

      console.debug('Devices were refreshed, checking that we have cameras.');

      // Verify if selected devices are valid
      var videoFlag = data.videoDevices.length > 0 ;

      var shareFlag = data.shareDevices.length > 0;

      var audioFlag = data.audioDevices.length > 0;

      var speakerFlag = data.speakerDevices.length > 0;

      // if (!videoFlag) storage.data.selectedVideo = data.videoDevices[0].id;
      // if (!shareFlag) storage.data.selectedShare = data.shareDevices[0].id;
      // if (!audioFlag) storage.data.selectedAudio = data.audioDevices[0].id;
      // if (!speakerFlag && data.speakerDevices.length > 0) storage.data.selectedSpeaker = data.speakerDevices[0].id;

      // This means that we cannot use video!
      if (data.videoDevices.length === 0) {
        //console.log('No camera, disabling video.');
        data.canVideo = false;
        data.videoDevices.push({
          id: 'none',
          label: 'No camera'
        });
      } else {
        data.canVideo = true;
      }

      // put data back on object

      //console.log('DDDDDD', data);
      // when done ... call here
      callback(status);
    });
  }

  static getInstanceData(){
    return VertoService.getInstance()._data;
  }

  static speedTest(callback=()=>{})  {
      const v = _verto.verto;
      if (v){
        //console.log('vvv is good');
        v.rpcClient.speedTest(1024 * 256, (e, data) => {
          const d = _verto._data;
          //console.log('spppppppppp', d, data)
          var upBand = Math.ceil(data.upKPS * .75),
              downBand = Math.ceil(data.downKPS * .75);


          //TODO if auto then do something with it
          // if (storage.data.autoBand) {
          //   storage.data.incomingBandwidth = downBand;
          //   storage.data.outgoingBandwidth = upBand;
          //   storage.data.useDedenc = false;
          //   storage.data.vidQual = 'hd';
          //
          //   if (upBand < 512) {
          //     storage.data.vidQual = 'qvga';
          //   }
          //   else if (upBand < 1024) {
          //     storage.data.vidQual = 'vga';
          //   }
          // }

          const returnData =  { ...data, upBand, downBand  };
          // assign vidQual here since it will need it down stream
          returnData.vidQual = d.vidQual;

          //console.log('^^^^',d, returnData);

          callback(returnData);
        });
      } else {
        //console.log('v is bad');
      }

    }


}

//exporting
export default VertoService;

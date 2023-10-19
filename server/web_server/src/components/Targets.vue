<template>

<div
  class="drop-zone"
  @keydown.up="onUp"
  @keydown.down="onDown"
  @keydown.left="onLeft"
  @keydown.right="onRight"
  @keyup.up="dropEvent"
  @keyup.down="dropEvent"
  @keyup.left="dropEvent"
  @keyup.right="dropEvent"
>
  <div class="d-flex flex-row align-baseline">
    <v-text-field
    v-model="search"
    placeholder="Seach Target Tree"
    flat
    hide-details
    @input="searchTree"
    rows="1"
    dense
    ></v-text-field>
    <v-btn class="ma-2 pa-2" outlined color="success" @click="exportTarget">
      export
    </v-btn>
  </div>
  <v-treeview
    class="mr-auto"
    :items="targets"
    item-text="value"
    activatable
    :active="active"
    return-object
    dense
    @update:active="selected"
    :search="search"
    :open.sync="open"
    :filter="filter"
  >
    <template v-slot:label="{item}">
      <div
        class="container ma-0 pa-0"
        draggable="true"
        @dragstart="startDrag($event, item)"
        @drop="onDrop($event, item)"
        @dragover.prevent @dragenter.prevent
      >
      <label class="draggable ma-0 pa-0" :id="item.id" :class="[item.metadata?.notify ?? '', item.metadata?.critical ?? '']">
        <p class="popup" v-if="item.metadata?.critical === 'high'">Similar machine is HackTheBOX {{ item.metadata.machine }}</p>
          <span
            @click="activate(item)"
            style="cursor: text;"
          >
            {{item.name}}
          </span>
          <div class="plus">
            <v-btn
              color="primary"
              class="ma-0 pa-0"
              dark
              x-small
              plain
            >
              <span @click="showDialog(item)">+</span>
            </v-btn>
          </div>
          <div class="minus">
            <v-btn
              color="primary"
              class="ma-0 pa-0"
              dark
              x-small
              depressed
              plain
            >
              <span @click="deleteTarget(item)">-</span>
            </v-btn>
          </div>
        </label>
      </div>
    </template>
  </v-treeview>

  <v-dialog v-model="dialog" max-width="600px">
    <v-card>
        <v-card-title class="headline">Input Form</v-card-title>
        <v-card-text>
<!--          <v-text-field v-model="hostname" label="hostname"></v-text-field> -->
          <v-row>
            <v-col cols="12"  v-if="ishostclicked">
              <span>OS</span>
              <v-radio-group v-model="os" row>
                <v-radio label="Windows" value="Windows"></v-radio>
                <v-radio label="Linux" value="Linux"></v-radio>
              </v-radio-group>
            </v-col>
            <v-col cols="12"  v-if="ishostclicked">
              <span>Getl Root Shell?</span>
              <v-radio-group v-model="root" row>
                <v-radio label="Yes" value="yes"></v-radio>
                <v-radio label="No" value="no"></v-radio>
              </v-radio-group>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12">
              <span>Credentials</span>
            </v-col>
            <v-col cols="6">
              <v-text-field v-model="userId" label="Username"></v-text-field>
            </v-col>
            <v-col cols="6">
              <v-text-field v-model="password" label="Password"></v-text-field>
            </v-col>
          </v-row>
          <v-text-field v-model="notes" label="You can add any notes. Please input \t if you want to add parent and child node."> </v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="green darken-1" text @click="dialog = false">Close</v-btn>
          <v-btn color="green darken-1" text @click="addTarget">Submit</v-btn>
        </v-card-actions>
      </v-card>
  </v-dialog>
</div>

</template>

<style scoped>

.container{
  margin:0.1px;
}
.plus{
  width: 25px;
  height: 25px;
  line-height: 0.1;
}
.minus{
  width: 25px;
  height: 25px;
}

.draggable {
  display: flex;
}

.draggable.dragging {
  opacity: .5;
}

.changed{
  animation: color-change 1.5s linear;
}

.high:hover .popup {
      display: block;
  }

.popup {
      display: none;
      width: 200px;
      position: absolute;
      top: 100;
      left: 350px;
      padding: 16px;
      border-radius: 5px;
      background: yellow;
      color: black;
      font-weight: bold;
      z-index: 1000;
}
.high{
  background-color: yellow;
}

@keyframes color-change {
  50%{
    background-color:gainsboro;
  }
}

</style>

<script>
import { EchidnaAPI } from '@echidna/api';
const echidna = new EchidnaAPI(location.hostname);
var targetsData = [{ id: 0, name: 'targets', parent: null, children: [] }];
export default {
  data: () => ({
    targets: targetsData,
    clickeditem: "",
    active: [],
    open: [],
    search: null,
    commands: [],
    command: '',
    dialog: false,
    offset: true,
    ishostclicked: false,
//    hostname: '', // comment out this code until the parser's output when the hostname changes is finalized
    os: '',
    root: '',
    userId: '',
    password: '',
    notes: ''
  }),
  mounted() {
    this.updateTargets();
    echidna.on('targets', this.updateTargets);
  },
  computed: {
    filter() {
      return (item, search, textKey) => item[textKey].includes(search);
    },
  },
  methods: {
    updateTargets() {
      echidna
      .targets()
      .then(({ data: targets }) => {
        this.targets.splice(0, 1, this.convertTargets(targets));
      })
      .catch((error) => {
        console.error(error);
      });
    },
    convertTargets(targets) {
      if (!targets?.length) return {};
      return this.convertTarget(targets[0], null, targets);
    },
    convertTarget(target, parent, targets) {
      const node = {
        id: target.id,
        parent,
        name: target.value,
        value: target.value,
        metadata: target.metadata,
      };
      node.children = target.children.map((child) => this.convertTarget(targets[child], node, targets));
      return node;
    },
    selected(targets) {
      console.log("target.vue Selected targets=", targets);
      this.$emit('selected', targets);
    },
    getTargetElements(target) {
      let elements = {};
      while (target?.id) {
        const parent = target.parent;
        if (!(parent?.value in elements)) {
          elements[parent.value] = target.value;
        }
        target = parent?.parent;
      }
      return elements;
    },
    showDialog(item){
      this.clickeditem = item;
      if (item.parent.value == "host"){
        this.ishostclicked = true;
      } else{
        this.ishostclicked = false;
      }
      this.dialog = true;
    },
    activate(item){
      this.active.splice(0, this.active.length);
      this.active.splice(0, 0, item);
    },
    exportTarget(){
      echidna
      .exportTarget()
        .then(({ data: target }) => {
          if (target == "done"){
            window.location.href = '/targets/export/download';
          }
        })
        .catch((error) => {
          console.error(error);
        });
    },
    addTarget(){
//      const inputdata = {hostname: this.hostname, os: this.os, root: this.root,  Credential: {userid: this.userId, password: this.password}, notes: this.notes};
      const inputdata = {os: this.os, root: this.root,  Credential: {userid: this.userId, password: this.password}, notes: this.notes};
      this.dialog = false;
      echidna
      .updateTarget(this.clickeditem.id, inputdata)
      .then(({ data: target }) => {
        console.debug("target: add", target);
      })
      .catch((error) => {
        console.error(error);
      });
    },
    deleteTarget(item){
      if (item.id == 0){
        console.info("can't remove root node");
      }else{
        this.$dialog
        .confirm({
          title: 'Delete Confirm',
          body: 'Do you want to delete the item "'+ item.name + '"? Child nodes are also removed. '
        },{
          okText: 'OK',
          cancelText: 'Cancel',
        })
        .then(function() {
          echidna
          .deleteTarget(item.id, item.parent.id)
          .then(() => {
            console.debug("target: delete", item.id);
          })
          .catch((error) => {
            console.error(error);
          });
        })
        .catch(function() {
          console.info('Delete a target was canceled.');
        });
      }
    },
    _isOpened(target) {
      return target && this.open.some(opened => opened.id === target.id);
    },
    _close(target) {
      this.$set(this, 'open', this.open.filter(opened => opened.id !== target.id));
    },
    _bottom(target) {
      if (target?.children.length && this._isOpened(target)) {
        return this._bottom(target.children[target.children.length - 1]);
      }
      return target;
    },
    _next(target) {
      const parent = target?.parent;
      if (!parent) return null;
      const brothers = parent?.children;
      const targetIndex = brothers?.findIndex(brother => brother === target);
      if (targetIndex < brothers.length - 1) {
        return brothers[targetIndex + 1];
      }
      return this._next(parent);
    },
    _up(target) {
      const parent = target?.parent;
      if (!parent) return null;
      const brothers = parent.children;
      const targetIndex = brothers.findIndex(brother => brother === target);
      if (targetIndex === 0) {
        return parent;
      }
      return this._bottom(brothers[targetIndex - 1]);
    },
    _down(target) {
      if (target.children.length && this._isOpened(target)) {
        return target.children[0];
      }
      return this._next(target);
    },
    dropEvent(evt) {
      evt.preventDefault();
      evt.stopPropagation();
    },
    onUp(evt) {
      if (!this.active.length) {
        this.active.push(this.targets[0]);
      }
      const target = this._up(this.active[0]);
      if (target) {
        this.$set(this.active, 0, target);
      }
      this.dropEvent(evt);
    },
    onDown(evt) {
      if (!this.active.length) {
        this.active.push(this.targets[0]);
      }
      const target = this._down(this.active[0]);
      if (target) {
        this.$set(this.active, 0, target);
      }
      this.dropEvent(evt);
    },
    onLeft(evt) {
      if (!this.active.length) {
        this.active.push(this.targets[0]);
      }
      const target = this.active[0];
      if (this._isOpened(target)) {
        this._close(target);
      } else {
        const nextTarget = this._up(target);
        if (nextTarget) {
          this.$set(this.active, 0, nextTarget);
        }
      }
      this.dropEvent(evt);
    },
    onRight(evt) {
      if (!this.active.length) {
        this.active.push(this.targets[0]);
      }
      const target = this.active[0];
      if (!this._isOpened(target)) {
        this.open.push(target);
      } else {
        const nextTarget = this._down(target);
        if (nextTarget) {
          this.$set(this.active, 0, nextTarget);
        }
      }
      this.dropEvent(evt);
    },
    startDrag(evt, target) {
      console.debug("drag: target", target.id, target.name);
      evt.dataTransfer.dropEffect = 'move';
      evt.dataTransfer.effectAllowed = 'move';
      evt.dataTransfer.setData('targetId', target.id);
      evt.dataTransfer.setData('parentId', target.parent.id);
    },
    onDrop(evt, newParent) {
      if (newParent) {
        const targetId = Number(evt.dataTransfer.getData('targetId'));
        const parentId = Number(evt.dataTransfer.getData('parentId'));
        console.debug(`drop: move ${targetId} from ${parentId} to ${newParent.id}`);
        echidna
        .moveTarget(targetId, parentId, newParent.id)
        .then(({ data: target }) => {
          console.debug("drop: moved", target);
        })
        .catch((error) => {
          console.error(error);
        });
      }
      evt.preventDefault();
      evt.stopPropagation();
    },
    searchTree(searchstring){
      setTimeout(() => {
        echidna
          .search(searchstring)
          .then(({ data: targets }) => {
            this.$set(this, 'open', targets);
          })
          .catch((error) => {
            console.error(error);
          });
        }, 800);
    },
  },
};
</script>

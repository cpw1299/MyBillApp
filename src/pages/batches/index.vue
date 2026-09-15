<template>
  <view class="container">
    <view class="header"><view><text class="title">批次管理</text><text class="hint">每个批次对应一次独立结账</text></view><button @click="createBatch">＋ 新建</button></view>
    <view v-for="batch in batches" :key="batch.id" class="card" :class="{ locked: batch.status !== 'active' }" @click="batch.status === 'active' && select(batch.id)">
      <view class="top"><text class="name">{{ batch.name }}</text><text class="status">{{ statusText(batch.status) }}</text></view>
      <view class="stats"><text>{{ store.getBatchQuantity(batch.id) }} 件</text><text>¥{{ store.getBatchAmount(batch.id).toFixed(2) }}</text></view>
      <view class="dates"><text>开始：{{ formatDate(batch.createdAt) }}</text><text v-if="batch.settledAt">结账：{{ formatDate(batch.settledAt) }}</text></view>
      <view class="actions" v-if="batch.status !== 'settled'" @click.stop>
        <button v-if="batch.status === 'active'" @click="complete(batch.id)">标记完成</button>
        <button class="settle" @click="settle(batch.id)">老板已结账</button>
      </view>
    </view>
    <view v-if="!batches.length" class="empty">还没有批次，先新建一个吧</view>
  </view>
</template>
<script setup>
import { computed, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
const store=useAppStore(); const batches=computed(()=>store.batches);
function statusText(s){return s==='active'?'进行中':s==='completed'?'已完成':'已结账';}
function formatDate(t){return new Date(t).toLocaleDateString('zh-CN');}
function createBatch(){uni.showModal({title:'新建批次',editable:true,placeholderText:'例如：9月第一批',success:r=>{if(r.confirm){store.createBatch(r.content||undefined);uni.showToast({title:'批次已创建',icon:'success'});}}});}
function select(id){if(store.selectBatch(id))uni.showToast({title:'已切换当前批次',icon:'success'});}
function complete(id){if(store.completeBatch(id))uni.showToast({title:'批次已完成',icon:'success'});}
function settle(id){uni.showModal({title:'确认结账',content:'确认老板已经结清这个批次吗？结账后不能继续往该批次记工。',success:r=>{if(r.confirm&&store.settleBatch(id))uni.showToast({title:'已标记为已结账',icon:'success'});}});}
onMounted(()=>{store.initProducts();store.initRecords();});
</script>
<style scoped>
.container{min-height:100vh;background:#f5f7fa;padding:24rpx}.header{background:#fff;border-radius:20rpx;padding:28rpx;display:flex;justify-content:space-between;align-items:center;margin-bottom:20rpx}.title{display:block;font-size:40rpx;font-weight:bold}.hint{display:block;color:#888;font-size:24rpx;margin-top:6rpx}.header button,.actions button{border:0;border-radius:12rpx;padding:12rpx 24rpx;background:#667eea;color:#fff}.card{background:#fff;border-radius:20rpx;padding:28rpx;margin-bottom:18rpx;box-shadow:0 3rpx 15rpx rgba(0,0,0,.06)}.card.locked{opacity:.72}.top,.stats,.dates{display:flex;justify-content:space-between;align-items:center}.name{font-size:34rpx;font-weight:700}.status{font-size:24rpx;color:#667eea}.stats{margin:22rpx 0;font-size:30rpx;color:#e67e22}.dates{font-size:23rpx;color:#999}.actions{display:flex;gap:16rpx;margin-top:22rpx}.actions .settle{background:#28a745}.empty{text-align:center;color:#999;padding:100rpx 20rpx}
</style>

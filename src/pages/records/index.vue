<template>
  <view class="container">
    <view class="filter"><picker mode="selector" :range="batchOptions" range-key="name" @change="onBatchChange"><view class="picker">{{ selectedBatchId ? selectedBatch?.name : '全部批次' }} ▼</view></picker><button @click="clearFilter">清除</button></view>
    <view v-for="group in groupedRecords" :key="group.batch.id" class="batch-card">
      <view class="batch-head"><view><text class="batch-name">{{ group.batch.name }}</text><text class="status">{{ statusText(group.batch.status) }}</text></view><view class="amount">¥{{ group.amount.toFixed(2) }}</view></view>
      <view class="batch-summary">{{ group.quantity }} 件 · {{ group.records.length }} 条记录</view>
      <view v-for="record in group.records" :key="record.id" class="record-item"><view class="info"><text class="date">{{ formatDate(record.date) }}</text><text class="product">{{ record.productName }}</text><text class="detail">{{ record.quantity }} 件 × {{ record.unitPrice }} 元</text></view><view class="right"><text class="fee">¥{{ record.fee.toFixed(2) }}</text><button @click="deleteRecord(record.id)">删除</button></view></view>
    </view>
    <view v-if="!groupedRecords.length" class="empty">暂无记录</view>
    <view v-if="groupedRecords.length" class="total">合计：{{ total.quantity }} 件　¥{{ total.amount.toFixed(2) }}</view>
  </view>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'; import { useAppStore } from '@/stores/app';
const store=useAppStore(); const selectedBatchId=ref(''); const batches=computed(()=>store.batches); const batchOptions=computed(()=>[{id:'',name:'全部批次'},...batches.value]); const selectedBatch=computed(()=>batches.value.find(b=>b.id===selectedBatchId.value));
const groupedRecords=computed(()=>{const ids=selectedBatchId.value?[selectedBatchId.value]:batches.value.map(b=>b.id);return ids.map(id=>{const batch=batches.value.find(b=>b.id===id);if(!batch)return null;const rs=store.getBatchRecords(id);return rs.length?{batch,records:rs,quantity:store.getBatchQuantity(id),amount:store.getBatchAmount(id)}:null}).filter(Boolean).sort((a,b)=>b.batch.createdAt-a.batch.createdAt);});
const total=computed(()=>({quantity:groupedRecords.value.reduce((s,g)=>s+g.quantity,0),amount:Number(groupedRecords.value.reduce((s,g)=>s+g.amount,0).toFixed(2))}));
function onBatchChange(e){selectedBatchId.value=batchOptions.value[Number(e.detail.value)]?.id||'';} function clearFilter(){selectedBatchId.value='';} function statusText(s){return s==='active'?'进行中':s==='completed'?'已完成':'已结账';} function formatDate(s){return s.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$1年$2月$3日');}
function deleteRecord(id){uni.showModal({title:'确认删除',content:'删除后会从对应批次中扣除这笔记录，确定吗？',success:r=>{if(r.confirm){store.removeRecord(id);uni.showToast({title:'删除成功',icon:'success'});}}});} onMounted(()=>{store.initProducts();store.initRecords();});
</script>
<style scoped>
.container{min-height:100vh;background:#f5f5f5;padding:20rpx}.filter{display:flex;gap:15rpx;background:#fff;padding:20rpx;border-radius:12rpx;margin-bottom:18rpx}.picker{flex:1;padding:20rpx;background:#f7f7f7;border-radius:10rpx}.filter button{background:#777;color:#fff}.batch-card{background:#fff;border-radius:16rpx;margin-bottom:18rpx;overflow:hidden}.batch-head{padding:24rpx;display:flex;justify-content:space-between;align-items:center}.batch-name{font-size:34rpx;font-weight:bold;display:block}.status{font-size:22rpx;color:#667eea}.amount{font-size:34rpx;font-weight:bold;color:#e67e22}.batch-summary{padding:0 24rpx 18rpx;color:#888;font-size:24rpx}.record-item{display:flex;justify-content:space-between;padding:20rpx 24rpx;border-top:1px solid #eee}.info{display:flex;flex-direction:column;gap:6rpx}.date,.detail{font-size:22rpx;color:#999}.product{font-size:30rpx;font-weight:600}.right{text-align:right}.fee{display:block;color:#ff6b35;font-size:28rpx;font-weight:bold;margin-bottom:8rpx}.right button{font-size:20rpx;background:#dc3545;color:#fff;padding:4rpx 12rpx}.total{position:sticky;bottom:20rpx;background:#333;color:#fff;border-radius:12rpx;padding:22rpx;text-align:center;font-size:28rpx}.empty{text-align:center;color:#999;padding:100rpx}
</style>

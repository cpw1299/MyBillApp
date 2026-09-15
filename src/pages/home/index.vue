<template>
  <view class="home-container">
    <view class="batch-card" @click="showBatchModal = true">
      <view><text class="batch-label">当前记账批次</text><text class="batch-name">{{ currentBatch?.name || '暂无批次' }}</text><text class="batch-status">{{ currentBatch ? '进行中 · 点击切换' : '点击创建批次' }}</text></view>
      <view class="batch-total"><text>{{ store.currentBatchQuantity }} 件</text><text>¥{{ store.currentBatchAmount.toFixed(2) }}</text></view>
    </view>
    <view class="date-selector" @click="showDateModal = true"><text class="selected-date">{{ displayDate }}</text><text class="date-hint">📅 实际做工日期（批次可跨天）</text></view>
    <view class="main-content">
      <view class="product-selection-section"><ProductSelector :products="products" :selected-product-id="selectedProductId" @select-product="handleProductSelect" @clear-selection="handleClearSelection" /></view>
      <view class="quantity-section"><QuantityInputEnhanced v-model="quantity" :max-quantity="9999" /></view>
      <view class="amount-section"><text class="amount-label">本次收入</text><view class="amount-display"><text class="amount-currency">¥</text><text class="amount-number">{{ calculatedAmount.toFixed(2) }}</text></view></view>
      <button @click="handleSaveRecord" class="save-button" :disabled="!canSaveRecord" :class="{ 'save-button-disabled': !canSaveRecord }">💾 保存到当前批次</button>
    </view>
    <view class="modal" v-if="showBatchModal" @click="showBatchModal = false"><view class="modal-content" @click.stop><text class="modal-title">选择记账批次</text><button class="new-batch" @click="createNewBatch">＋ 新建批次</button><view v-for="batch in batches" :key="batch.id" class="batch-row" @click="selectBatch(batch.id)"><view><text class="row-name">{{ batch.name }}</text><text class="row-status">{{ statusText(batch.status) }} · {{ store.getBatchQuantity(batch.id) }}件 · ¥{{ store.getBatchAmount(batch.id).toFixed(2) }}</text></view><text v-if="batch.id === store.currentBatchId" class="checked">✓</text></view></view></view>
    <view class="modal" v-if="showDateModal" @click="showDateModal = false"><view class="modal-content" @click.stop><text class="modal-title">选择做工日期</text><text class="modal-subtitle">批次可以跨多个日期</text><picker mode="date" :value="selectedDate" :end="todayDate" @change="onDateChange"><view class="picker-display">{{ selectedDate }}</view></picker><button @click="showDateModal = false">确定</button></view></view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useAppStore } from '@/stores/app';
import ProductSelector from '@/components/ProductSelector.vue';
import QuantityInputEnhanced from '@/components/QuantityInputEnhanced.vue';
import { QuantityValidator } from '@/utils/productIcons.js';
const store = useAppStore();
const selectedProductId = ref(''); const quantity = ref(1); const selectedDate = ref(''); const showDateModal = ref(false); const showBatchModal = ref(false);
const products = computed(() => store.products); const batches = computed(() => store.batches); const currentBatch = computed(() => store.currentBatch); const todayDate = computed(() => new Date().toISOString().slice(0,10));
const isToday = computed(() => selectedDate.value === todayDate.value); const displayDate = computed(() => isToday.value ? '今天' : formatDate(selectedDate.value)); const selectedProduct = computed(() => products.value.find(p => p.id === selectedProductId.value));
const calculatedAmount = computed(() => selectedProduct.value ? QuantityValidator.normalize(quantity.value) * selectedProduct.value.unitPrice : 0);
const canSaveRecord = computed(() => !!selectedProduct.value && !!currentBatch.value && currentBatch.value.status === 'active' && QuantityValidator.validate(quantity.value).valid);
function createNewBatch() { uni.showModal({ title:'新建批次', editable:true, placeholderText:'例如：9月第一批', success:r=>{ if(r.confirm){ const b=store.createBatch(r.content || undefined); showBatchModal.value=false; uni.showToast({title:`${b.name}已创建`,icon:'success'}); } } }); }
function selectBatch(id) { if(store.selectBatch(id)){ showBatchModal.value=false; } }
function statusText(s){ return s==='active'?'进行中':s==='completed'?'已完成':'已结账'; }
function handleProductSelect(p){selectedProductId.value=p.id;} function handleClearSelection(){selectedProductId.value='';} function onDateChange(e){selectedDate.value=e.detail.value;}
function formatDate(s){ if(!s)return ''; const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m?`${m[1]}年${m[2]}月${m[3]}日`:s; }
function handleSaveRecord(){ if(!canSaveRecord.value){uni.showToast({title:!currentBatch.value?'请先创建批次':!selectedProduct.value?'请先选择工件':'数量不能为0',icon:'none'});return;} const r=store.createRecord({batchId:currentBatch.value.id,date:selectedDate.value,productId:selectedProductId.value,quantity:quantity.value}); if(r.ok){quantity.value=1;selectedProductId.value='';uni.showToast({title:'已保存到当前批次',icon:'success'});}else uni.showToast({title:r.message,icon:'none'}); }
function init(){store.initProducts();store.initRecords();if(!selectedDate.value)selectedDate.value=todayDate.value;store.ensureCurrentBatch();} onMounted(init); onShow(()=>{if(!store.products.length)store.initProducts();if(!store.batches.length)store.initRecords();if(!selectedDate.value)selectedDate.value=todayDate.value;});
</script>

<style scoped>
.home-container{min-height:100vh;background:#f5f7fa;padding:20rpx}.batch-card,.date-selector,.product-selection-section,.quantity-section,.amount-section{background:#fff;border-radius:20rpx;box-shadow:0 4rpx 20rpx rgba(0,0,0,.08)}.batch-card{padding:28rpx;display:flex;justify-content:space-between;align-items:center;margin-bottom:20rpx}.batch-label,.batch-status,.date-hint{display:block;color:#888;font-size:24rpx}.batch-name{display:block;font-size:38rpx;font-weight:700;color:#263238;margin:8rpx 0}.batch-total{text-align:right;color:#e67e22;font-size:26rpx}.batch-total text{display:block;margin:6rpx 0}.date-selector{padding:24rpx;text-align:center;margin-bottom:20rpx}.selected-date{display:block;font-size:32rpx;font-weight:600;color:#34495e}.main-content{display:flex;flex-direction:column;gap:24rpx}.product-selection-section{padding:20rpx}.quantity-section,.amount-section{padding:36rpx}.amount-section{text-align:center}.amount-label{display:block;font-size:30rpx;color:#777}.amount-display{display:flex;justify-content:center;align-items:baseline;gap:8rpx}.amount-currency,.amount-number{color:#e74c3c}.amount-currency{font-size:44rpx}.amount-number{font-size:76rpx;font-weight:bold}.save-button{background:#667eea;color:#fff;border:0;border-radius:20rpx;padding:36rpx;font-size:38rpx;font-weight:600}.save-button-disabled{background:#999;opacity:.6}.modal{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000}.modal-content{background:#fff;border-radius:24rpx;padding:30rpx;width:88%;max-height:80vh;overflow:auto}.modal-title{display:block;text-align:center;font-size:40rpx;font-weight:bold;margin-bottom:24rpx}.modal-subtitle{display:block;color:#888;font-size:24rpx;margin-bottom:20rpx}.new-batch{background:#667eea;color:#fff;margin-bottom:20rpx}.batch-row{display:flex;justify-content:space-between;align-items:center;padding:24rpx 10rpx;border-bottom:1px solid #eee}.row-name{display:block;font-size:32rpx;font-weight:600}.row-status{display:block;color:#888;font-size:23rpx;margin-top:6rpx}.checked{font-size:38rpx;color:#28a745}.picker-display{padding:26rpx;background:#f5f5f5;border-radius:12rpx;text-align:center;font-size:34rpx;margin-bottom:20rpx}
</style>
